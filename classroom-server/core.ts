import { randomBytes, randomUUID } from 'node:crypto';
import http from 'node:http';
import type { z } from 'zod';
import type { Db } from '../src/core/db/database';
import { sha256 } from '../src/core/passwords';
import type { Clock } from '../src/core/util';
import { SchoolSettingsSchema, type Accommodation, AccommodationBody, type ClassRole, type SchoolSettings, type UserDto, type UserRole } from '../src/shared/classroom/protocol';
import type { AiProvider, AiUsage } from './ai/provider';
import type { Scanner } from './scan';
import type { Storage } from './storage';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const notFound = (what = 'That') => new HttpError(404, 'not_found', `${what} was not found.`);
export const forbidden = (message = 'You do not have access to this.') => new HttpError(403, 'forbidden', message);

export interface UserRow {
  id: string;
  school_id: string;
  role: UserRole;
  display_name: string;
  login: string;
  password_hash: string;
}
export interface ClassRow {
  id: string;
  school_id: string;
  name: string;
  section: string;
  school_year: string;
  course_id: string | null;
  course_label: string | null;
  ends_on: string | null;
  under13: number;
  archived_at: string | null;
  created_by: string;
  created_at: string;
}

export interface Ctx {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  user: UserRow | null;
  /** True when the session came from the browser cookie (the token is never given to page scripts). */
  cookieAuth: boolean;
  body: unknown;
  raw: Buffer | null;
  ip: string;
}
/** Returned by handlers that wrote the response themselves (streams, downloads). */
export const HANDLED = Symbol('handled');
export type Handler = (c: Ctx, params: string[]) => unknown;
export interface RouteOptions {
  /** Read the body as bytes (uploads) up to this many bytes instead of JSON. */
  rawLimit?: number;
  /** Counts against the stricter sign-in limit. */
  auth?: boolean;
}

export interface ClassroomOptions {
  dbPath: string;
  /** Where files and the key file live. */
  dataDir: string;
  name?: string;
  clock?: Clock;
  masterKey?: string | null;
  /** When set, creating a school needs this code. When null, the first school can be created freely and later ones not at all. */
  setupCode?: string | null;
  /** Fixed provider (tests). Otherwise one is made per school from its key, or from serverApiKey. */
  ai?: AiProvider | null;
  serverApiKey?: string | null;
  aiBaseUrl?: string;
  scanner?: Scanner;
  storage?: Storage;
  /** The Ontario curriculum bundle (resources/curriculum/ontario.json.gz), for linking classes and questions to real expectations. */
  curriculumPath?: string | null;
  /** Directory of the browser build to serve at "/". */
  webDir?: string | null;
  /** Mark cookies Secure (set when served over https). */
  secureCookies?: boolean;
  /** Requests per minute per signed-in user or per address. */
  rateLimit?: number;
  /** How often to look for finished batches, expired attempts and expired classes; 0 turns the timer off (tests). */
  sweepSeconds?: number;
  log?: (line: string) => void;
}

/** Shared services handed to every route module. */
export interface S {
  db: Db;
  clock: Clock;
  opts: ClassroomOptions;
  key: Buffer;
  storage: Storage;
  scanner: Scanner;
  now(): string;
  route(method: string, path: string, handler: Handler, o?: RouteOptions): void;
  parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T>;
  requireUser(c: Ctx): UserRow;
  requireRole(c: Ctx, ...roles: UserRole[]): UserRow;
  userDto(u: UserRow): UserDto;
  issueSession(userId: string): string;
  settings(schoolId: string): SchoolSettings;
  /** The AI provider for a school, or null when no key is configured. */
  ai(schoolId: string): AiProvider | null;
  aiKeySource(schoolId: string): 'school' | 'server' | 'none';
  audit(actor: UserRow | null, schoolId: string, action: string, target: string, detail?: string): void;
  recordUsage(u: { schoolId: string; classId: string | null; assessmentId: string | null; kind: string; model: string; usage: AiUsage; discount?: number }): void;
  budget(schoolId: string): { month: string; cost: number; budget: number | null; state: 'ok' | 'warning' | 'paused'; inputTokens: number; outputTokens: number; requests: number };
  /** The class and the caller's role in it; 404 for people who are not in it (so its existence is not revealed). */
  classFor(c: Ctx, classId: string, need?: 'member' | 'teacher' | 'student'): { cls: ClassRow; role: ClassRole; user: UserRow };
  accommodation(classId: string, userId: string): Accommodation;
  /** Jobs other modules register to run on the periodic sweep. */
  sweeps: (() => Promise<void> | void)[];
  /** Called after an attempt is submitted (by the student or by the clock). */
  onSubmitted: ((attemptId: string) => void)[];
  /** Resolves when background AI work (evaluations started on submit) has finished. */
  idle(): Promise<void>;
  newId(): string;
  code(groups?: number): string;
}

export const NO_ACCOMMODATION: Accommodation = AccommodationBody.parse({});
export const parseSettings = (raw: string | null | undefined): SchoolSettings => {
  let v: unknown = {};
  try {
    v = JSON.parse(raw ?? '{}');
  } catch {
    /* fall back to defaults */
  }
  const r = SchoolSettingsSchema.safeParse(v);
  return r.success ? r.data : SchoolSettingsSchema.parse({});
};
export const json = <T>(raw: string | null | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = sha256;
export const uuid = () => randomUUID();
