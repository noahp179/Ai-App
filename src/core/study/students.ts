import { z } from 'zod';
import { EXPLANATION_STYLES, GOAL_KINDS, type StudentListItem, type StudentProfile } from '../../shared/study/types';
import type { Db } from '../db/database';
import { json } from '../db/database';
import { hashSecret, verifySecret } from '../passwords';
import { type Clock, NotFoundError, UserError, newId } from '../util';

/**
 * Student profiles on this computer. A profile holds only what is needed to personalise learning: a first name
 * or nickname, grade, chosen courses, goals and preferences. A profile can have its own PIN so other people
 * using the computer cannot open it.
 */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const ProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter a first name or nickname.')
    .max(40, 'Keep the name under 40 characters.'),
  grade: z.number().int().min(6, 'Student Learning covers Grades 6 to 12.').max(12, 'Student Learning covers Grades 6 to 12.'),
  courseIds: z.array(z.string().max(80)).max(20).default([]),
  goalKinds: z.array(z.enum(GOAL_KINDS)).max(8).default([]),
  goals: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
  explanationStyle: z.enum(EXPLANATION_STYLES).default('step_by_step'),
  confidence: z.record(z.string().max(80), z.number().int().min(1).max(5)).default({}),
  studyDays: z
    .array(z.number().int().min(1).max(7))
    .max(7)
    .default([1, 2, 3, 4, 5])
    .transform((d) => [...new Set(d)].sort() as (1 | 2 | 3 | 4 | 5 | 6 | 7)[]),
  dailyMinutes: z.number().int().min(5).max(240).default(30),
  sessionMinutes: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(30)]).default(20),
  studyTime: hhmm.default('16:30'),
  accessibility: z
    .object({
      textScale: z.number().min(0.9).max(1.6).default(1),
      readableFont: z.boolean().default(false),
      simplifiedLanguage: z.boolean().default(false),
      extraTime: z.boolean().default(false),
      reduceMotion: z.boolean().default(false),
    })
    .prefault({}),
  aiTutoring: z.boolean().default(false),
  shareProgressWithAi: z.boolean().default(false),
  parentSharing: z
    .object({ enabled: z.boolean().default(false), goals: z.boolean().default(false), activities: z.boolean().default(false), progress: z.boolean().default(false) })
    .prefault({}),
  autoSchedule: z.boolean().default(false),
  onboarded: z.boolean().default(false),
});
type ProfileData = z.infer<typeof ProfileSchema>;

interface Row {
  id: string;
  display_name: string;
  grade: number;
  profile: string;
  pin_hash: string | null;
  pin_failures: number;
  pin_locked_until: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_TRIES = 5;
const LOCK_MS = 5 * 60_000;

export class StudentsService {
  private activeId: string | null = null;

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  private now() {
    return this.clock.now().toISOString();
  }

  private row(id: string): Row {
    const r = this.db.get<Row>('SELECT * FROM students WHERE id = ?', [id]);
    if (!r) throw new NotFoundError('That student profile');
    return r;
  }

  private toProfile(r: Row): StudentProfile {
    const p = ProfileSchema.parse({ ...json<Record<string, unknown>>(r.profile, {}), displayName: r.display_name, grade: r.grade });
    return { id: r.id, ...p, grade: p.grade as StudentProfile['grade'], hasPin: !!r.pin_hash, createdAt: r.created_at, updatedAt: r.updated_at };
  }

  /** Names and grades only, so someone can pick their profile. Nothing else is shown before a profile is opened. */
  list(): StudentListItem[] {
    return this.db
      .all<Row>('SELECT * FROM students ORDER BY display_name COLLATE NOCASE')
      .map((r) => ({ id: r.id, displayName: r.display_name, grade: r.grade as StudentListItem['grade'], hasPin: !!r.pin_hash, active: r.id === this.activeId }));
  }

  count(): number {
    return this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM students')!.n;
  }

  create(input: unknown, pin?: string | null): StudentProfile {
    const p = ProfileSchema.parse(input ?? {});
    if (this.count() >= 12) throw new UserError('This computer already has 12 student profiles. Remove one first.');
    if (pin) this.validatePin(pin);
    const id = newId();
    const now = this.now();
    const { displayName, grade, ...rest } = p;
    this.db.run('INSERT INTO students (id, display_name, grade, profile, pin_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, displayName, grade, JSON.stringify(rest), pin ? hashSecret(pin) : null, now, now]);
    this.activeId = id;
    return this.toProfile(this.row(id));
  }

  private validatePin(pin: unknown): string {
    if (typeof pin !== 'string' || pin.length < 4 || pin.length > 32) throw new UserError('A profile PIN needs 4 to 32 characters.');
    return pin;
  }

  /** Opens a profile. Profiles with a PIN need it; repeated wrong PINs lock the profile for a few minutes. */
  open(id: string, pin?: string | null): StudentProfile {
    const r = this.row(id);
    if (r.pin_hash) {
      const now = this.clock.now();
      if (r.pin_locked_until && new Date(r.pin_locked_until) > now) {
        const mins = Math.ceil((new Date(r.pin_locked_until).getTime() - now.getTime()) / 60_000);
        throw new UserError(`Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 'locked');
      }
      if (typeof pin !== 'string' || !verifySecret(pin, r.pin_hash)) {
        const failures = r.pin_failures + 1;
        if (failures >= MAX_TRIES) {
          this.db.run('UPDATE students SET pin_failures = 0, pin_locked_until = ? WHERE id = ?', [new Date(now.getTime() + LOCK_MS).toISOString(), id]);
          throw new UserError('Wrong PIN. This profile is locked for 5 minutes.', 'locked');
        }
        this.db.run('UPDATE students SET pin_failures = ? WHERE id = ?', [failures, id]);
        throw new UserError(`Wrong PIN. ${MAX_TRIES - failures} tries left.`, 'wrong_pin');
      }
      this.db.run('UPDATE students SET pin_failures = 0, pin_locked_until = NULL WHERE id = ?', [id]);
    }
    this.activeId = id;
    return this.toProfile(r);
  }

  close(): void {
    this.activeId = null;
  }

  activeIdOrNull(): string | null {
    if (this.activeId && !this.db.get('SELECT 1 FROM students WHERE id = ?', [this.activeId])) this.activeId = null;
    return this.activeId;
  }

  /** The open profile, or an error asking the student to choose one. Every student-data call goes through this. */
  active(): StudentProfile {
    const id = this.activeIdOrNull();
    if (!id) throw new UserError('Choose or create your student profile first.', 'no_student');
    return this.toProfile(this.row(id));
  }

  activeOrNull(): StudentProfile | null {
    const id = this.activeIdOrNull();
    return id ? this.toProfile(this.row(id)) : null;
  }

  get(id: string): StudentProfile {
    return this.toProfile(this.row(id));
  }

  update(patch: unknown): StudentProfile {
    const cur = this.active();
    const { id, hasPin, createdAt, updatedAt, ...data } = cur;
    void hasPin;
    void createdAt;
    void updatedAt;
    const merged = ProfileSchema.parse({ ...data, ...(patch as object), accessibility: { ...data.accessibility, ...((patch as { accessibility?: object })?.accessibility ?? {}) }, parentSharing: { ...data.parentSharing, ...((patch as { parentSharing?: object })?.parentSharing ?? {}) } });
    const { displayName, grade, ...rest } = merged;
    this.db.run('UPDATE students SET display_name = ?, grade = ?, profile = ?, updated_at = ? WHERE id = ?', [displayName, grade, JSON.stringify(rest satisfies Omit<ProfileData, 'displayName' | 'grade'>), this.now(), id]);
    return this.toProfile(this.row(id));
  }

  /** Sets, changes or removes the open profile's PIN. Changing or removing an existing PIN needs the current one. */
  setPin(currentPin: string | null, newPin: string | null): void {
    const cur = this.active();
    const r = this.row(cur.id);
    if (r.pin_hash && (typeof currentPin !== 'string' || !verifySecret(currentPin, r.pin_hash))) throw new UserError('The current PIN is not right.', 'wrong_pin');
    if (newPin) this.validatePin(newPin);
    this.db.run('UPDATE students SET pin_hash = ?, pin_failures = 0, pin_locked_until = NULL, updated_at = ? WHERE id = ?', [newPin ? hashSecret(newPin) : null, this.now(), cur.id]);
  }

  /** Parent reset of a forgotten profile PIN. The caller must have checked the parental PIN. */
  resetPinByParent(id: string): void {
    this.row(id);
    this.db.run('UPDATE students SET pin_hash = NULL, pin_failures = 0, pin_locked_until = NULL, updated_at = ? WHERE id = ?', [this.now(), id]);
  }

  /** Deletes the open profile and everything recorded for it. The student types their profile name to confirm. */
  deleteActive(confirmName: string): void {
    const cur = this.active();
    if (typeof confirmName !== 'string' || confirmName.trim().toLowerCase() !== cur.displayName.trim().toLowerCase()) throw new UserError(`Type the profile name (${cur.displayName}) to confirm.`);
    this.db.run('DELETE FROM students WHERE id = ?', [cur.id]);
    this.activeId = null;
  }

  /** Removes a profile the caller is allowed to remove (its PIN or the parental PIN was checked). */
  deleteById(id: string): void {
    this.row(id);
    this.db.run('DELETE FROM students WHERE id = ?', [id]);
    if (this.activeId === id) this.activeId = null;
  }

  verifyPinFor(id: string, pin: string | null | undefined): boolean {
    const r = this.row(id);
    return !r.pin_hash || (typeof pin === 'string' && verifySecret(pin, r.pin_hash));
  }
}
