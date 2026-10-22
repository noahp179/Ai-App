import { z } from 'zod';
import type { CopyContext } from '../shared/api';
import { LOCKABLE_MODULES, isModuleOpen } from '../shared/parental';
import { MODULE_IDS, type ModuleId } from '../shared/settings';
import type { ParentalConfig, ParentalStatus, StudySession } from '../shared/types';
import type { Db } from './db/database';
import { json } from './db/database';
import type { KvStore } from './kv';
import { hashSecret, randomCode, verifySecret } from './passwords';
import { type Clock, UserError, cleanLine, newId } from './util';

const STATE = 'parental:state';
const MAX_ATTEMPTS = 5;
const BASE_LOCK_MS = 5 * 60_000;
const MAX_LOCK_MS = 60 * 60_000;

export const DEFAULT_PARENTAL_CONFIG: ParentalConfig = {
  copyRestriction: true,
  screenCapturePrivacy: false,
  tutorMode: true,
  lockedModules: [],
  sessionAllowedModules: ['learning', 'notes', 'ai', 'calendar', 'productivity'],
};

export const TUTOR_PROMPT = [
  'You are helping a student learn. Act as a patient tutor:',
  '- Guide them with questions, hints and explanations instead of handing over finished answers.',
  '- Do not write complete essays, assignments, homework answers or test answers for them; help them plan, understand and check their own work.',
  '- Ask what they already know or have tried when that would help.',
  '- Keep explanations clear and age-appropriate, and encourage them to explain ideas back in their own words.',
].join('\n');

const Config = z.object({
  copyRestriction: z.boolean(),
  screenCapturePrivacy: z.boolean(),
  tutorMode: z.boolean(),
  lockedModules: z
    .array(z.enum(MODULE_IDS as unknown as [ModuleId, ...ModuleId[]]))
    .max(30)
    .refine((ids) => ids.every((id) => LOCKABLE_MODULES.includes(id)), 'Home and Settings cannot be locked.')
    .transform((ids) => [...new Set(ids)]),
  sessionAllowedModules: z.array(z.enum(MODULE_IDS as unknown as [ModuleId, ...ModuleId[]])).max(30),
});

/** Settings saved by earlier versions had a games-only switch; it becomes a lock on Games. */
function upgradeConfig(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const { hideGamesOutsideSessions, ...rest } = raw as Record<string, unknown> & { hideGamesOutsideSessions?: boolean };
  if (Array.isArray(rest.lockedModules)) return rest;
  return { ...rest, lockedModules: hideGamesOutsideSessions ? ['games'] : [] };
}

interface State {
  enabled: boolean;
  configuredAt: string | null;
  pinHash: string | null;
  recoveryHash: string | null;
  config: ParentalConfig;
  failedAttempts: number;
  lockouts: number;
  lockedUntil: string | null;
}

const OFF: State = { enabled: false, configuredAt: null, pinHash: null, recoveryHash: null, config: DEFAULT_PARENTAL_CONFIG, failedAttempts: 0, lockouts: 0, lockedUntil: null };

interface SessionRow {
  id: string;
  goal: string;
  allowed_modules: string;
  started_at: string;
  ends_at: string;
  ended_at: string | null;
  ended_by: 'timer' | 'parent' | null;
}
const toSession = (r: SessionRow): StudySession => ({
  id: r.id,
  goal: r.goal,
  allowedModules: json<string[]>(r.allowed_modules, []),
  startedAt: r.started_at,
  endsAt: r.ends_at,
  endedAt: r.ended_at,
  endedBy: r.ended_by,
});

export interface PlatformSupport {
  os: string;
  contentProtection: { supported: boolean; applied: boolean; detail: string };
}

/**
 * Optional parental learning controls. Off by default; turned on only through explicit setup with a PIN.
 * Everything here applies inside FlowCompanion only. Nothing is monitored or recorded beyond session start/end times.
 */
export class ParentalService {
  constructor(
    private readonly db: Db,
    private readonly kv: KvStore,
    private readonly clock: Clock,
  ) {}

  private state(): State {
    const s = this.kv.get<Partial<State> | null>(STATE, null);
    if (!s) return { ...OFF };
    const cfg = Config.safeParse(upgradeConfig(s.config));
    return { ...OFF, ...s, config: cfg.success ? cfg.data : DEFAULT_PARENTAL_CONFIG };
  }

  private save(s: State): void {
    this.kv.set(STATE, s);
  }

  get enabled(): boolean {
    return this.state().enabled;
  }

  config(): ParentalConfig {
    return this.state().config;
  }

  status(platform: PlatformSupport): ParentalStatus {
    const s = this.state();
    return {
      enabled: s.enabled,
      configuredAt: s.configuredAt,
      config: s.config,
      lockedUntil: s.lockedUntil && new Date(s.lockedUntil) > this.clock.now() ? s.lockedUntil : null,
      failedAttempts: s.failedAttempts,
      attemptsBeforeLockout: MAX_ATTEMPTS - s.failedAttempts,
      platform: {
        os: platform.os,
        copyRestriction: {
          supported: true,
          scope: 'AI answers inside FlowCompanion (main window and floating companion): copy buttons, keyboard copy and text selection. It does not apply to other apps or websites, and cannot stop screenshots, photos of the screen or retyping.',
        },
        screenCapturePrivacy: { supported: platform.contentProtection.supported, applied: s.enabled && s.config.screenCapturePrivacy && platform.contentProtection.applied, detail: platform.contentProtection.detail },
        otherAppsAndWebsites: {
          supported: false,
          detail: 'FlowCompanion cannot control or see other apps or AI websites. The browser extension only sends pages to FlowCompanion; it does not enforce these controls.',
        },
      },
      session: this.activeSession(),
    };
  }

  private validatePin(pin: unknown): string {
    if (typeof pin !== 'string' || pin.length < 4 || pin.length > 64) throw new UserError('Choose a PIN or passphrase of at least 4 characters.');
    return pin;
  }

  /** Checks a PIN (or recovery code) with escalating lockout after repeated failures. */
  private authorize(secret: unknown, which: 'pin' | 'recovery' = 'pin'): State {
    const s = this.state();
    if (!s.enabled) throw new UserError('Parental learning controls are off.');
    const now = this.clock.now();
    if (s.lockedUntil && new Date(s.lockedUntil) > now) {
      const mins = Math.ceil((new Date(s.lockedUntil).getTime() - now.getTime()) / 60_000);
      throw new UserError(`Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 'locked');
    }
    const ok = typeof secret === 'string' && verifySecret(which === 'pin' ? secret : normalizeCode(secret), which === 'pin' ? s.pinHash : s.recoveryHash);
    if (!ok) {
      const failed = s.failedAttempts + 1;
      if (failed >= MAX_ATTEMPTS) {
        const ms = Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** s.lockouts);
        this.save({ ...s, failedAttempts: 0, lockouts: s.lockouts + 1, lockedUntil: new Date(now.getTime() + ms).toISOString() });
        throw new UserError(`Wrong ${which === 'pin' ? 'PIN' : 'recovery code'}. Locked for ${Math.round(ms / 60_000)} minutes.`, 'locked');
      }
      this.save({ ...s, failedAttempts: failed });
      throw new UserError(`Wrong ${which === 'pin' ? 'PIN' : 'recovery code'}. ${MAX_ATTEMPTS - failed} attempt${MAX_ATTEMPTS - failed === 1 ? '' : 's'} left before a lockout.`, 'wrong_pin');
    }
    const fresh = { ...s, failedAttempts: 0, lockouts: 0, lockedUntil: null };
    this.save(fresh);
    return fresh;
  }

  /** Turns the controls on. Requires reading the scope explanation (acknowledged) and a PIN. Returns a one-time recovery code. */
  setup(input: { pin: string; config?: Partial<ParentalConfig>; acknowledged: boolean }): { recoveryCode: string } {
    if (this.state().enabled) throw new UserError('Parental learning controls are already on.');
    if (input?.acknowledged !== true) throw new UserError('Read what these controls can and cannot do, then confirm.');
    const pin = this.validatePin(input.pin);
    const config = Config.parse({ ...DEFAULT_PARENTAL_CONFIG, ...(input.config ?? {}) });
    const recoveryCode = randomCode(4);
    this.save({ ...OFF, enabled: true, configuredAt: this.clock.now().toISOString(), pinHash: hashSecret(pin), recoveryHash: hashSecret(normalizeCode(recoveryCode)), config });
    return { recoveryCode };
  }

  updateConfig(pin: string, patch: Partial<ParentalConfig>): ParentalConfig {
    const s = this.authorize(pin);
    const config = Config.parse({ ...s.config, ...(patch ?? {}) });
    this.save({ ...s, config });
    return config;
  }

  changePin(pin: string, newPin: string): void {
    const s = this.authorize(pin);
    this.save({ ...s, pinHash: hashSecret(this.validatePin(newPin)) });
  }

  /** Recovery code → new PIN. The used code is replaced by a new one, shown once. */
  recover(code: string, newPin: string): { recoveryCode: string } {
    const pin = this.validatePin(newPin);
    const s = this.authorize(code, 'recovery');
    const recoveryCode = randomCode(4);
    this.save({ ...s, pinHash: hashSecret(pin), recoveryHash: hashSecret(normalizeCode(recoveryCode)) });
    return { recoveryCode };
  }

  /** Turns everything off and ends any session. */
  disable(pin: string): void {
    this.authorize(pin);
    this.endSessionRow('parent');
    this.kv.delete(STATE);
  }

  // ───────── Supervised study sessions ─────────

  activeSession(): StudySession | null {
    const r = this.db.get<SessionRow>('SELECT * FROM study_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
    if (!r) return null;
    return new Date(r.ends_at) > this.clock.now() ? toSession(r) : null;
  }

  startSession(pin: string, input: { goal: string; minutes: number; allowedModules?: string[] }): StudySession {
    const s = this.authorize(pin);
    if (this.activeSession()) throw new UserError('A study session is already running.');
    this.completeDueSession();
    const minutes = Math.trunc(Number(input?.minutes));
    if (!(minutes >= 5 && minutes <= 480)) throw new UserError('Choose a session length from 5 minutes to 8 hours.');
    const allowed = Config.shape.sessionAllowedModules.parse(input?.allowedModules ?? s.config.sessionAllowedModules);
    const now = this.clock.now();
    const id = newId();
    this.db.run('INSERT INTO study_sessions (id, goal, allowed_modules, started_at, ends_at) VALUES (?, ?, ?, ?, ?)', [
      id,
      cleanLine(input?.goal ?? '', 200),
      JSON.stringify([...new Set(allowed)]),
      now.toISOString(),
      new Date(now.getTime() + minutes * 60_000).toISOString(),
    ]);
    return toSession(this.db.get<SessionRow>('SELECT * FROM study_sessions WHERE id = ?', [id])!);
  }

  endSession(pin: string): StudySession | null {
    this.authorize(pin);
    return this.endSessionRow('parent');
  }

  private endSessionRow(by: 'parent' | 'timer'): StudySession | null {
    const r = this.db.get<SessionRow>('SELECT * FROM study_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
    if (!r) return null;
    const at = by === 'timer' ? r.ends_at : this.clock.now().toISOString();
    this.db.run('UPDATE study_sessions SET ended_at = ?, ended_by = ? WHERE id = ?', [at, by, r.id]);
    return toSession(this.db.get<SessionRow>('SELECT * FROM study_sessions WHERE id = ?', [r.id])!);
  }

  /** When the open session is due to end (for the scheduler). */
  nextSessionEnd(): Date | null {
    const r = this.db.get<SessionRow>('SELECT * FROM study_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1');
    return r ? new Date(r.ends_at) : null;
  }

  /** Closes a session whose time is up, including one that ran out while the app was closed. */
  completeDueSession(): StudySession | null {
    const end = this.nextSessionEnd();
    return end && end <= this.clock.now() ? this.endSessionRow('timer') : null;
  }

  recentSessions(limit = 20): StudySession[] {
    return this.db.all<SessionRow>('SELECT * FROM study_sessions ORDER BY started_at DESC LIMIT ?', [limit]).map(toSession);
  }

  // ───────── Enforcement hooks ─────────

  isModuleAllowed(id: ModuleId): boolean {
    const s = this.state();
    return isModuleOpen(s.enabled, s.config, s.enabled ? this.activeSession() : null, id);
  }

  /** Why a section is closed right now, or null if it is open. */
  lockReason(id: ModuleId): string | null {
    if (this.isModuleAllowed(id)) return null;
    return this.activeSession() ? 'This section is not part of the current study session.' : 'This section is locked by Parental Learning Controls.';
  }

  copyBlockedReason(context: CopyContext): string | null {
    const s = this.state();
    if (!s.enabled || !s.config.copyRestriction || context !== 'ai') return null;
    return 'Copying AI answers is turned off by Parental Learning Controls. Write the ideas in your own words instead.';
  }

  tutorPrompt(): string | null {
    const s = this.state();
    return s.enabled && s.config.tutorMode ? TUTOR_PROMPT : null;
  }

  wantsContentProtection(): boolean {
    const s = this.state();
    return s.enabled && s.config.screenCapturePrivacy;
  }
}

function normalizeCode(code: string): string {
  return String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** What the OS documents for keeping a window out of screenshots and recordings. Used to report support honestly. */
export function contentProtectionSupport(platform: string, release: string): { supported: boolean; detail: string } {
  const caveat = 'Some capture methods may still record the window, and nothing can stop a photo of the screen.';
  if (platform === 'darwin') return { supported: true, detail: `Asks macOS to keep FlowCompanion windows out of screenshots and screen sharing. ${caveat}` };
  if (platform === 'win32') {
    const build = Number(release.split('.')[2] ?? 0);
    return build >= 19041
      ? { supported: true, detail: `Asks Windows to exclude FlowCompanion windows from screenshots and screen recordings. ${caveat}` }
      : { supported: true, detail: `On this Windows version, captured FlowCompanion windows appear black instead of hidden. ${caveat}` };
  }
  return { supported: false, detail: `${platform === 'linux' ? 'Linux' : 'This operating system'} has no documented way for an app to keep its windows out of screenshots or screen recordings, so this control is not available here.` };
}
