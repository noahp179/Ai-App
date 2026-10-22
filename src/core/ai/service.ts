import { z } from 'zod';
import type { Settings } from '../../shared/settings';
import type {
  AiErrorInfo,
  AiStreamEvent,
  Conversation,
  Message,
  ModelInfo,
  ProviderConfig,
  ProviderKind,
  ProviderStatus,
  SendMessageInput,
} from '../../shared/types';
import type { AiTasksService } from '../aitasks';
import type { Db } from '../db/database';
import { bool, ftsQuery, json } from '../db/database';
import type { SecretStore } from '../secrets';
import { type Clock, NotFoundError, UserError, cleanLine, newId, safeHttpUrl } from '../util';
import { ADAPTERS, adapterFor } from './registry';
import { resilientFetch } from './errors';
import { AiError, type ChatTurn, type ProviderRuntime } from './types';

interface ProviderRow {
  id: string;
  kind: ProviderKind;
  name: string;
  base_url: string;
  default_model: string | null;
  enabled: number;
  key_storage: string;
  last_status: string | null;
  options: string;
  created_at: string;
  updated_at: string;
}

interface ConversationRow {
  id: string;
  title: string;
  provider_id: string | null;
  model: string | null;
  system_prompt: string;
  archived_at: string | null;
  ephemeral: number;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_preview?: string | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: Message['role'];
  content: string;
  status: Message['status'];
  error: string | null;
  provider_id: string | null;
  provider_kind: ProviderKind | null;
  model: string | null;
  usage: string | null;
  provider_payload: string | null;
  served_model: string | null;
  notices: string;
  created_at: string;
  finished_at: string | null;
}

const KINDS = Object.keys(ADAPTERS) as ProviderKind[];

const ProviderInput = z.object({
  kind: z.enum(KINDS as [ProviderKind, ...ProviderKind[]]),
  name: z.string().max(80).optional(),
  baseUrl: z.string().max(500).optional(),
  defaultModel: z.string().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
  apiKey: z.string().max(500).nullable().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const AnthropicOptionsSchema = z.object({
  effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).nullable().optional(),
  refusalFallback: z.boolean().optional(),
  preserveThinking: z.boolean().optional(),
});

/** Context the user explicitly attached to a message. Resolved by the caller (notes, events, tasks). */
export type AttachmentResolver = (a: { type: 'note' | 'event' | 'task'; id: string }) => { label: string; text: string } | null;

export interface AiServiceDeps {
  db: Db;
  clock: Clock;
  secrets: SecretStore;
  settings: () => Settings;
  tasks: AiTasksService;
  fetch: typeof fetch;
  emitStream: (e: AiStreamEvent) => void;
  emitChanged: (entity: 'conversations' | 'providers', id?: string) => void;
  /** Called when a response finishes while no FlowCompanion window has focus. */
  notifyDone: (c: Conversation, m: Message) => void;
  isFocused: () => boolean;
  resolveAttachment: AttachmentResolver;
  /** Extra system instructions from parental tutor mode, or null. */
  extraSystemPrompt: () => string | null;
}

const secretName = (providerId: string) => `provider:${providerId}:apiKey`;

function toMessage(r: MessageRow): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    status: r.status,
    error: json<AiErrorInfo | null>(r.error, null),
    providerId: r.provider_id,
    providerKind: r.provider_kind,
    model: r.model,
    usage: json(r.usage, null),
    servedModel: r.served_model,
    notices: json<string[]>(r.notices, []),
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  };
}

function toConversation(r: ConversationRow): Conversation {
  return {
    id: r.id,
    title: r.title,
    providerId: r.provider_id,
    model: r.model,
    systemPrompt: r.system_prompt,
    archivedAt: r.archived_at,
    ephemeral: bool(r.ephemeral),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    messageCount: r.message_count,
    lastMessagePreview: r.last_preview ?? undefined,
  };
}

export function titleFromPrompt(text: string): string {
  const line = cleanLine(text.replace(/[#*_`>]/g, ' '), 200);
  if (line.length <= 60) return line || 'New conversation';
  const cut = line.slice(0, 60);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trimEnd()}…`;
}

/** The AI workspace: providers, conversations and the request lifecycle. */
export class AiService {
  private readonly active = new Map<string, { ctrl: AbortController; conversationId: string; taskId: string }>();
  private readonly fetch: typeof fetch;

  constructor(private readonly d: AiServiceDeps) {
    this.fetch = resilientFetch(d.fetch);
  }

  private get db() {
    return this.d.db;
  }
  private now(): string {
    return this.d.clock.now().toISOString();
  }

  // ─────────── Providers ───────────

  private providerRow(id: string): ProviderRow {
    const r = this.db.get<ProviderRow>('SELECT * FROM providers WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That AI provider');
    return r;
  }

  private toProvider(r: ProviderRow): ProviderConfig & { options: Record<string, unknown> } {
    const storage = this.d.secrets.storageOf(secretName(r.id));
    return {
      id: r.id,
      kind: r.kind,
      name: r.name,
      baseUrl: r.base_url,
      defaultModel: r.default_model,
      enabled: bool(r.enabled),
      hasApiKey: storage !== 'none',
      keyStorage: storage,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastStatus: json<ProviderStatus | null>(r.last_status, null),
      options: json<Record<string, unknown>>(r.options, {}),
    };
  }

  providers(): (ProviderConfig & { options: Record<string, unknown> })[] {
    return this.db.all<ProviderRow>('SELECT * FROM providers ORDER BY created_at').map((r) => this.toProvider(r));
  }

  provider(id: string) {
    return this.toProvider(this.providerRow(id));
  }

  /** Static information about each provider type, for the setup screen. */
  catalog() {
    return KINDS.map((k) => {
      const a = ADAPTERS[k];
      return { kind: k, label: a.label, defaultBaseUrl: a.defaultBaseUrl, capabilities: a.capabilities, suggestedModels: a.suggestedModels, setupHelp: a.setupHelp };
    });
  }

  private cleanBaseUrl(kind: ProviderKind, raw: string | undefined): string {
    const url = safeHttpUrl(raw?.trim() || adapterFor(kind).defaultBaseUrl);
    if (!url) throw new UserError('The provider address must be an http(s) URL.');
    const u = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(u.hostname);
    if (u.protocol === 'http:' && !local && !/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(u.hostname)) {
      throw new UserError('Use https for remote providers. Plain http is only allowed for servers on this computer or your local network.');
    }
    return url.replace(/\/+$/, '');
  }

  private cleanOptions(kind: ProviderKind, options: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!options) return {};
    if (kind === 'anthropic') return AnthropicOptionsSchema.parse(options);
    return {};
  }

  createProvider(input: unknown) {
    const d = ProviderInput.parse(input);
    const adapter = adapterFor(d.kind);
    const id = newId();
    const now = this.now();
    const options = this.cleanOptions(d.kind, d.options ?? (d.kind === 'anthropic' ? { effort: null, refusalFallback: true, preserveThinking: true } : {}));
    this.db.run(
      `INSERT INTO providers (id, kind, name, base_url, default_model, enabled, key_storage, last_status, options, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'none', NULL, ?, ?, ?)`,
      [
        id,
        d.kind,
        cleanLine(d.name ?? '', 80) || adapter.label,
        this.cleanBaseUrl(d.kind, d.baseUrl),
        d.defaultModel ?? adapter.suggestedModels[0]?.id ?? null,
        d.enabled ?? true,
        JSON.stringify(options),
        now,
        now,
      ],
    );
    if (d.apiKey) this.setApiKey(id, d.apiKey);
    if (!this.d.settings().ai.defaultProviderId || !this.db.get('SELECT 1 FROM providers WHERE id = ?', [this.d.settings().ai.defaultProviderId])) {
      // First provider becomes the default; the caller persists this via settings.
      this.firstProviderCreated = id;
    }
    this.d.emitChanged('providers', id);
    return this.provider(id);
  }

  /** Set when a newly created provider should become the default. Read and cleared by the app layer. */
  firstProviderCreated: string | null = null;

  updateProvider(id: string, patch: unknown) {
    const cur = this.providerRow(id);
    const d = ProviderInput.partial().parse(patch);
    const options = d.options !== undefined ? this.cleanOptions(cur.kind, { ...json(cur.options, {}), ...d.options }) : json(cur.options, {});
    this.db.run('UPDATE providers SET name = ?, base_url = ?, default_model = ?, enabled = ?, options = ?, updated_at = ? WHERE id = ?', [
      d.name !== undefined ? cleanLine(d.name, 80) || cur.name : cur.name,
      d.baseUrl !== undefined ? this.cleanBaseUrl(cur.kind, d.baseUrl) : cur.base_url,
      d.defaultModel !== undefined ? d.defaultModel : cur.default_model,
      d.enabled ?? bool(cur.enabled),
      JSON.stringify(options),
      this.now(),
      id,
    ]);
    if (d.apiKey !== undefined) this.setApiKey(id, d.apiKey);
    this.d.emitChanged('providers', id);
    return this.provider(id);
  }

  /** Stores (or with null, removes) a provider key. Returns where it was stored. */
  setApiKey(id: string, key: string | null): 'secure' | 'session' | 'none' {
    this.providerRow(id);
    const clean = key?.trim() ?? '';
    if (!clean) {
      this.d.secrets.delete(secretName(id));
      this.db.run("UPDATE providers SET key_storage = 'none', updated_at = ? WHERE id = ?", [this.now(), id]);
      return 'none';
    }
    if (/\s/.test(clean)) throw new UserError('API keys cannot contain spaces.');
    const where = this.d.secrets.set(secretName(id), clean);
    this.db.run('UPDATE providers SET key_storage = ?, updated_at = ? WHERE id = ?', [where, this.now(), id]);
    this.d.emitChanged('providers', id);
    return where;
  }

  /** Disconnects a provider: removes it and its key. Conversations keep their history. */
  deleteProvider(id: string): void {
    this.providerRow(id);
    for (const [msgId, a] of this.active) {
      const m = this.db.get<{ provider_id: string }>('SELECT provider_id FROM messages WHERE id = ?', [msgId]);
      if (m?.provider_id === id) a.ctrl.abort();
    }
    this.d.secrets.delete(secretName(id));
    this.db.run('DELETE FROM providers WHERE id = ?', [id]);
    this.d.emitChanged('providers', id);
  }

  private runtime(r: ProviderRow): ProviderRuntime {
    const adapter = adapterFor(r.kind);
    const apiKey = this.d.secrets.get(secretName(r.id));
    if (adapter.capabilities.requiresApiKey && !apiKey) {
      throw new AiError(
        'not_configured',
        r.key_storage === 'secure'
          ? `The saved API key for ${r.name} could not be read (the system keychain may have been reset). Enter it again in Settings → AI providers.`
          : `${r.name} needs an API key. Add it in Settings → AI providers.`,
      );
    }
    return {
      baseUrl: r.base_url,
      apiKey,
      options: json(r.options, {}),
      fetch: this.fetch,
      timeoutMs: this.d.settings().ai.requestTimeoutSeconds * 1000,
    };
  }

  /** Checks a provider by listing its models. The result is saved and shown in the UI. */
  async testProvider(id: string): Promise<ProviderStatus> {
    const r = this.providerRow(id);
    let status: ProviderStatus;
    try {
      const models = await adapterFor(r.kind).listModels(this.runtime(r), new AbortController().signal);
      status = {
        ok: true,
        checkedAt: this.now(),
        message: models.length ? `Connected. ${models.length} model${models.length === 1 ? '' : 's'} available.` : 'Connected, but no models were listed.',
        models,
      };
    } catch (err) {
      status = { ok: false, checkedAt: this.now(), message: err instanceof Error ? err.message : String(err), models: [] };
    }
    this.db.run('UPDATE providers SET last_status = ? WHERE id = ?', [JSON.stringify(status), id]);
    this.d.emitChanged('providers', id);
    return status;
  }

  models(id: string): ModelInfo[] {
    const p = this.provider(id);
    const listed = p.lastStatus?.models ?? [];
    if (listed.length) return listed;
    return adapterFor(p.kind).suggestedModels;
  }

  status() {
    const providers = this.providers();
    const usable = providers.filter((p) => p.enabled && (p.hasApiKey || !adapterFor(p.kind).capabilities.requiresApiKey));
    return {
      configured: usable.length > 0,
      providerCount: providers.length,
      defaultProviderId: this.d.settings().ai.defaultProviderId,
      activeRequests: this.active.size,
    };
  }

  // ─────────── Conversations ───────────

  private convRow(id: string): ConversationRow {
    const r = this.db.get<ConversationRow>('SELECT * FROM conversations WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That conversation');
    return r;
  }

  listConversations(q: { archived?: boolean; search?: string } = {}): Conversation[] {
    const where = [q.archived ? 'c.archived_at IS NOT NULL' : 'c.archived_at IS NULL'];
    const params: string[] = [];
    const fts = q.search ? ftsQuery(q.search) : null;
    if (fts) {
      where.push(`(c.id IN (SELECT parent_id FROM search_index WHERE search_index MATCH ? AND type = 'message')
                 OR c.id IN (SELECT ref_id FROM search_index WHERE search_index MATCH ? AND type = 'conversation'))`);
      params.push(fts, fts);
    }
    return this.db
      .all<ConversationRow>(
        `SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
                (SELECT substr(content, 1, 140) FROM messages m WHERE m.conversation_id = c.id ORDER BY m.rowid DESC LIMIT 1) AS last_preview
         FROM conversations c WHERE ${where.join(' AND ')} ORDER BY c.updated_at DESC LIMIT 1000`,
        params,
      )
      .map(toConversation);
  }

  conversation(id: string): Conversation {
    return toConversation(this.convRow(id));
  }

  messages(conversationId: string): Message[] {
    this.convRow(conversationId);
    return this.db.all<MessageRow>('SELECT * FROM messages WHERE conversation_id = ? ORDER BY rowid', [conversationId]).map(toMessage);
  }

  createConversation(input: { title?: string; providerId?: string | null; model?: string | null; systemPrompt?: string } = {}): Conversation {
    const id = newId();
    const now = this.now();
    const s = this.d.settings();
    const providerId = input.providerId ?? s.ai.defaultProviderId ?? null;
    if (providerId) this.providerRow(providerId);
    const model = input.model ?? (providerId ? this.providerRow(providerId).default_model : null);
    this.db.run(
      `INSERT INTO conversations (id, title, provider_id, model, system_prompt, archived_at, ephemeral, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [id, cleanLine(input.title ?? '', 200) || 'New conversation', providerId, model, (input.systemPrompt ?? '').slice(0, 8000), !s.ai.storeConversations, now, now],
    );
    this.d.emitChanged('conversations', id);
    return this.conversation(id);
  }

  updateConversation(id: string, patch: { title?: string; providerId?: string | null; model?: string | null; systemPrompt?: string }): Conversation {
    const cur = this.convRow(id);
    if (patch.providerId) this.providerRow(patch.providerId);
    let model = patch.model !== undefined ? patch.model : cur.model;
    if (patch.providerId !== undefined && patch.providerId !== cur.provider_id && patch.model === undefined) {
      model = patch.providerId ? this.providerRow(patch.providerId).default_model : null;
    }
    this.db.run('UPDATE conversations SET title = ?, provider_id = ?, model = ?, system_prompt = ?, updated_at = ? WHERE id = ?', [
      patch.title !== undefined ? cleanLine(patch.title, 200) || cur.title : cur.title,
      patch.providerId !== undefined ? patch.providerId : cur.provider_id,
      model,
      patch.systemPrompt !== undefined ? patch.systemPrompt.slice(0, 8000) : cur.system_prompt,
      this.now(),
      id,
    ]);
    this.d.emitChanged('conversations', id);
    return this.conversation(id);
  }

  archiveConversation(id: string, archived: boolean): Conversation {
    this.convRow(id);
    this.db.run('UPDATE conversations SET archived_at = ? WHERE id = ?', [archived ? this.now() : null, id]);
    this.d.emitChanged('conversations', id);
    return this.conversation(id);
  }

  deleteConversation(id: string): void {
    this.convRow(id);
    for (const [msgId, a] of this.active) if (a.conversationId === id) this.cancel(msgId);
    this.db.tx(() => {
      this.db.run("DELETE FROM links WHERE (from_type = 'conversation' AND from_id = ?) OR (to_type = 'conversation' AND to_id = ?)", [id, id]);
      this.db.run('DELETE FROM conversations WHERE id = ?', [id]);
    });
    this.d.emitChanged('conversations', id);
  }

  deleteAllConversations(): number {
    for (const id of [...this.active.keys()]) this.cancel(id);
    const n = this.db.tx(() => {
      this.db.run("DELETE FROM links WHERE from_type = 'conversation' OR to_type = 'conversation'");
      return this.db.run('DELETE FROM conversations').changes;
    });
    this.d.emitChanged('conversations');
    return n;
  }

  // ─────────── Sending ───────────

  private resolveProvider(conv: ConversationRow, input: SendMessageInput): ProviderRow {
    const id = input.providerId ?? conv.provider_id ?? this.d.settings().ai.defaultProviderId;
    const row = id ? this.db.get<ProviderRow>('SELECT * FROM providers WHERE id = ?', [id]) : undefined;
    if (!row) {
      throw new UserError('No AI provider is connected yet. Connect one in Settings → AI providers to send messages.', 'not_configured');
    }
    if (!bool(row.enabled)) throw new UserError(`${row.name} is turned off. Turn it on in Settings → AI providers.`, 'not_configured');
    return row;
  }

  private systemPrompt(conv: ConversationRow): string {
    return [this.d.settings().ai.systemPrompt, conv.system_prompt, this.d.extraSystemPrompt()]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join('\n\n');
  }

  /**
   * Sends a user message and starts the response. Returns immediately; the
   * response arrives as ai.stream events and is saved as it streams.
   */
  send(input: SendMessageInput): { userMessage: Message; assistantMessage: Message } {
    if (typeof input?.content !== 'string' || !input.content.trim()) throw new UserError('Type a message first.');
    if (input.content.length > 200_000) throw new UserError('That message is too long (over 200,000 characters).');
    const conv = this.convRow(input.conversationId);
    for (const a of this.active.values()) {
      if (a.conversationId === conv.id) throw new UserError('A response is still being written in this conversation. Wait or stop it first.');
    }
    const provider = this.resolveProvider(conv, input);
    const model = (input.model ?? (conv.provider_id === provider.id ? conv.model : null) ?? provider.default_model)?.trim();
    if (!model) throw new UserError(`Choose a model for ${provider.name} first.`, 'not_configured');
    this.runtime(provider); // fail fast on a missing key, before anything is saved

    let content = input.content.trim();
    for (const a of input.attachments ?? []) {
      const resolved = this.d.resolveAttachment(a);
      if (!resolved) throw new UserError('An attached item no longer exists.');
      content += `\n\n---\n**Attached ${resolved.label}**\n\n${resolved.text}`;
    }

    const now = this.now();
    const userId = newId();
    const assistantId = newId();
    const isFirst = !this.db.get('SELECT 1 FROM messages WHERE conversation_id = ?', [conv.id]);
    this.db.tx(() => {
      this.db.run(
        `INSERT INTO messages (id, conversation_id, role, content, status, error, provider_id, provider_kind, model, usage, created_at, finished_at)
         VALUES (?, ?, 'user', ?, 'complete', NULL, ?, ?, ?, NULL, ?, ?)`,
        [userId, conv.id, content, provider.id, provider.kind, model, now, now],
      );
      this.db.run(
        `INSERT INTO messages (id, conversation_id, role, content, status, error, provider_id, provider_kind, model, usage, created_at, finished_at)
         VALUES (?, ?, 'assistant', '', 'streaming', NULL, ?, ?, ?, NULL, ?, NULL)`,
        [assistantId, conv.id, provider.id, provider.kind, model, now],
      );
      this.db.run('UPDATE conversations SET provider_id = ?, model = ?, title = ?, updated_at = ? WHERE id = ?', [
        provider.id,
        model,
        isFirst && conv.title === 'New conversation' ? titleFromPrompt(input.content) : conv.title,
        now,
        conv.id,
      ]);
    });
    this.d.emitChanged('conversations', conv.id);
    void this.run(conv.id, assistantId, provider, model);
    const msgs = this.messages(conv.id);
    return { userMessage: msgs.find((m) => m.id === userId)!, assistantMessage: msgs.find((m) => m.id === assistantId)! };
  }

  /** Re-runs the response to the last user message (for errors, cancellations or a different model). */
  retry(assistantMessageId: string, opts: { providerId?: string | null; model?: string | null } = {}): Message {
    const msg = this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', [assistantMessageId]);
    if (!msg || msg.role !== 'assistant') throw new NotFoundError('That response');
    if (this.active.has(assistantMessageId)) throw new UserError('This response is still being written.');
    const last = this.db.get<{ id: string }>('SELECT id FROM messages WHERE conversation_id = ? ORDER BY rowid DESC LIMIT 1', [msg.conversation_id]);
    if (last?.id !== msg.id) throw new UserError('Only the latest response can be regenerated.');
    const conv = this.convRow(msg.conversation_id);
    // Retry with what is selected now (the user may have just switched model after an error).
    const provider = this.resolveProvider(conv, { conversationId: conv.id, content: 'x', providerId: opts.providerId ?? conv.provider_id ?? msg.provider_id });
    const model = (opts.model ?? (provider.id === conv.provider_id ? conv.model : null) ?? provider.default_model)?.trim();
    if (!model) throw new UserError(`Choose a model for ${provider.name} first.`);
    this.runtime(provider);
    this.db.run(
      `UPDATE messages SET content = '', status = 'streaming', error = NULL, usage = NULL, provider_payload = NULL, served_model = NULL,
       notices = '[]', provider_id = ?, provider_kind = ?, model = ?, finished_at = NULL WHERE id = ?`,
      [provider.id, provider.kind, model, msg.id],
    );
    this.db.run('UPDATE conversations SET provider_id = ?, model = ?, updated_at = ? WHERE id = ?', [provider.id, model, this.now(), conv.id]);
    void this.run(conv.id, msg.id, provider, model);
    return toMessage(this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', [msg.id])!);
  }

  cancel(assistantMessageId: string): boolean {
    const a = this.active.get(assistantMessageId);
    if (!a) return false;
    a.ctrl.abort();
    return true;
  }

  isActive(assistantMessageId: string): boolean {
    return this.active.has(assistantMessageId);
  }

  /** Waits for all in-flight requests (used by tests and on shutdown). */
  async idle(): Promise<void> {
    while (this.active.size > 0) await new Promise((r) => setTimeout(r, 10));
  }

  private history(conversationId: string, beforeId: string): ChatTurn[] {
    const rows = this.db.all<MessageRow>('SELECT * FROM messages WHERE conversation_id = ? ORDER BY rowid', [conversationId]);
    const turns: ChatTurn[] = [];
    for (const r of rows) {
      if (r.id === beforeId) break;
      if (r.role === 'user') turns.push({ role: 'user', content: r.content });
      else if (r.role === 'assistant' && r.status === 'complete' && r.content.trim()) {
        turns.push({ role: 'assistant', content: r.content, payload: json(r.provider_payload, undefined), payloadKind: r.provider_kind, model: r.model });
      }
    }
    return turns;
  }

  private async run(conversationId: string, messageId: string, provider: ProviderRow, model: string): Promise<void> {
    const ctrl = new AbortController();
    const conv = this.convRow(conversationId);
    const task = this.d.tasks.create({
      title: conv.title,
      source: 'native',
      confidence: 'confirmed',
      refType: 'conversation',
      refId: conversationId,
      detail: `${provider.name} · ${model}`,
    });
    this.active.set(messageId, { ctrl, conversationId, taskId: task.id });
    const s = this.d.settings();
    let text = '';
    let lastSave = Date.now();
    const save = () => this.db.run('UPDATE messages SET content = ? WHERE id = ?', [text, messageId]);
    const emit = (e: Omit<AiStreamEvent, 'conversationId' | 'messageId'>) => this.d.emitStream({ conversationId, messageId, ...e });

    try {
      const adapter = adapterFor(provider.kind);
      const result = await adapter.chat(
        this.runtime(provider),
        {
          model,
          system: this.systemPrompt(conv),
          messages: this.history(conversationId, messageId),
          maxTokens: s.ai.maxOutputTokens > 0 ? s.ai.maxOutputTokens : null,
          // Claude's API no longer accepts sampling parameters.
          temperature: provider.kind === 'anthropic' ? null : s.ai.temperature,
          stream: s.ai.streaming,
        },
        (delta) => {
          text += delta;
          emit({ kind: 'delta', delta });
          if (Date.now() - lastSave > 1000) {
            save();
            lastSave = Date.now();
          }
        },
        ctrl.signal,
      );
      const final = result.text || text;
      this.db.run(
        `UPDATE messages SET content = ?, status = 'complete', usage = ?, provider_payload = ?, served_model = ?, notices = ?, finished_at = ? WHERE id = ?`,
        [
          final,
          result.usage ? JSON.stringify(result.usage) : null,
          result.payload === undefined ? null : JSON.stringify(result.payload),
          result.servedModel ?? null,
          JSON.stringify(result.notices),
          this.now(),
          messageId,
        ],
      );
      this.db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [this.now(), conversationId]);
      this.d.tasks.setState(task.id, 'completed', 'confirmed', `${provider.name} · ${result.servedModel ?? model}`);
      emit({ kind: 'done' });
      if (s.ai.notifyOnCompletion && !this.d.isFocused()) {
        this.d.notifyDone(this.conversation(conversationId), toMessage(this.db.get<MessageRow>('SELECT * FROM messages WHERE id = ?', [messageId])!));
        this.d.tasks.markNotified(task.id);
      }
    } catch (err) {
      const e =
        err instanceof AiError
          ? err
          : err instanceof UserError
            ? new AiError('not_configured', err.message)
            : new AiError('unknown', err instanceof Error ? err.message : String(err));
      const canceled = e.code === 'canceled';
      const info: AiErrorInfo = { code: e.code, message: e.message, status: e.status, retryAfterSeconds: e.retryAfterSeconds };
      this.db.run('UPDATE messages SET content = ?, status = ?, error = ?, finished_at = ? WHERE id = ?', [
        text,
        canceled ? 'canceled' : 'error',
        canceled ? null : JSON.stringify(info),
        this.now(),
        messageId,
      ]);
      this.d.tasks.setState(task.id, canceled ? 'canceled' : 'failed', 'confirmed', canceled ? 'Stopped by you.' : e.message.slice(0, 300));
      emit(canceled ? { kind: 'canceled' } : { kind: 'error', error: info });
    } finally {
      this.active.delete(messageId);
      this.d.emitChanged('conversations', conversationId);
    }
  }

  // ─────────── One-off requests ───────────

  /**
   * A request outside any conversation (student lessons and tutoring). Uses the default provider unless one is
   * given, honours the same key, timeout and error handling as chats, and shows up in AI task status.
   * Nothing is stored here; the caller decides what to keep.
   */
  async complete(input: {
    title: string;
    system: string;
    messages: ChatTurn[];
    maxTokens?: number | null;
    providerId?: string | null;
    model?: string | null;
    onDelta?: (delta: string) => void;
    signal?: AbortSignal;
  }): Promise<{ text: string; providerId: string; providerName: string; model: string; notices: string[] }> {
    const id = input.providerId ?? this.d.settings().ai.defaultProviderId;
    const provider = id ? this.db.get<ProviderRow>('SELECT * FROM providers WHERE id = ?', [id]) : undefined;
    if (!provider) throw new UserError('No AI provider is connected. Connect one in Settings → AI providers, or keep studying with the offline lessons.', 'not_configured');
    if (!bool(provider.enabled)) throw new UserError(`${provider.name} is turned off. Turn it on in Settings → AI providers.`, 'not_configured');
    const model = (input.model ?? provider.default_model)?.trim();
    if (!model) throw new UserError(`Choose a model for ${provider.name} in Settings → AI providers.`, 'not_configured');
    const runtime = this.runtime(provider);
    const s = this.d.settings();
    const task = this.d.tasks.create({ title: input.title, source: 'native', confidence: 'confirmed', refType: 'study', detail: `${provider.name} · ${model}` });
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    input.signal?.addEventListener('abort', onAbort);
    try {
      let streamed = '';
      const result = await adapterFor(provider.kind).chat(
        runtime,
        {
          model,
          system: input.system,
          messages: input.messages,
          maxTokens: input.maxTokens ?? (s.ai.maxOutputTokens > 0 ? s.ai.maxOutputTokens : null),
          temperature: provider.kind === 'anthropic' ? null : s.ai.temperature,
          stream: !!input.onDelta && s.ai.streaming,
        },
        (delta) => {
          streamed += delta;
          input.onDelta?.(delta);
        },
        ctrl.signal,
      );
      this.d.tasks.setState(task.id, 'completed', 'confirmed', `${provider.name} · ${result.servedModel ?? model}`);
      return { text: result.text || streamed, providerId: provider.id, providerName: provider.name, model: result.servedModel ?? model, notices: result.notices };
    } catch (err) {
      const e = err instanceof AiError ? err : new AiError('unknown', err instanceof Error ? err.message : String(err));
      this.d.tasks.setState(task.id, e.code === 'canceled' ? 'canceled' : 'failed', 'confirmed', e.message.slice(0, 300));
      throw e.code === 'canceled' ? new UserError('Stopped.', 'canceled') : new UserError(e.message, e.code);
    } finally {
      input.signal?.removeEventListener('abort', onAbort);
    }
  }

  // ─────────── Housekeeping ───────────

  /**
   * Startup clean-up: responses cut off by a crash are marked as interrupted,
   * temporary conversations are removed and the retention period is applied.
   */
  housekeeping(): { interrupted: number; ephemeralRemoved: number; expired: number } {
    const interrupted = this.db.run(
      `UPDATE messages SET status = 'error', error = ?, finished_at = ? WHERE status = 'streaming'`,
      [JSON.stringify({ code: 'unknown', message: 'Interrupted: FlowCompanion closed before this response finished.' } satisfies AiErrorInfo), this.now()],
    ).changes;
    const ephemeralRemoved = this.db.run('DELETE FROM conversations WHERE ephemeral = 1').changes;
    let expired = 0;
    const days = this.d.settings().ai.retentionDays;
    if (days > 0) {
      const cutoff = new Date(this.d.clock.now().getTime() - days * 86_400_000).toISOString();
      expired = this.db.run('DELETE FROM conversations WHERE updated_at < ?', [cutoff]).changes;
    }
    this.d.tasks.recoverAfterRestart();
    return { interrupted, ephemeralRemoved, expired };
  }

  exportConversation(id: string, format: 'markdown' | 'json'): { filename: string; content: string } {
    const c = this.conversation(id);
    const msgs = this.messages(id);
    const base = c.title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 80) || 'conversation';
    if (format === 'json') {
      return {
        filename: `${base}.json`,
        content: JSON.stringify(
          {
            format: 'flowcompanion.conversation',
            version: 1,
            exportedAt: this.now(),
            title: c.title,
            systemPrompt: c.systemPrompt,
            messages: msgs.map((m) => ({ role: m.role, content: m.content, status: m.status, model: m.servedModel ?? m.model, createdAt: m.createdAt })),
          },
          null,
          2,
        ),
      };
    }
    const lines = [`# ${c.title}`, '', `_Exported from FlowCompanion on ${this.now()}_`, ''];
    for (const m of msgs) {
      const who = m.role === 'user' ? 'You' : `Assistant${m.servedModel ?? m.model ? ` (${m.servedModel ?? m.model})` : ''}`;
      lines.push(`## ${who}`, '', m.content || (m.status === 'error' ? `_Error: ${m.error?.message ?? 'failed'}_` : '_(no content)_'), '');
    }
    return { filename: `${base}.md`, content: lines.join('\n') };
  }
}
