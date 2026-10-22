// Parental learning controls acceptance tests PA–PO.
// The original PA–PO wording was not included in the project brief, so these are derived from its section 23
// requirements and adapted to what this implementation actually supports. Each test name starts with its ID.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KvStore } from '../../src/core/kv';
import { ParentalService, TUTOR_PROMPT, contentProtectionSupport, type PlatformSupport } from '../../src/core/parental';
import { FakeClock, memoryDb } from '../helpers/db';

const linux: PlatformSupport = { os: 'linux', contentProtection: { ...contentProtectionSupport('linux', '6.1'), applied: false } };
const mac: PlatformSupport = { os: 'darwin', contentProtection: { ...contentProtectionSupport('darwin', '24.0'), applied: true } };

function setup() {
  const db = memoryDb();
  const clock = new FakeClock('2026-10-20T15:00:00Z');
  const kv = new KvStore(db, clock);
  return { db, clock, kv, p: new ParentalService(db, kv, clock), reopen: () => new ParentalService(db, new KvStore(db, clock), clock) };
}
function on(p: ParentalService, cfg = {}) {
  return p.setup({ pin: '2468', acknowledged: true, config: cfg });
}

describe('Parental learning controls (PA–PO)', () => {
  it('PA: everything is off by default and nothing is restricted', () => {
    const { p } = setup();
    const s = p.status(linux);
    expect(s.enabled).toBe(false);
    expect(s.session).toBeNull();
    expect(p.copyBlockedReason('ai')).toBeNull();
    expect(p.tutorPrompt()).toBeNull();
    expect(p.wantsContentProtection()).toBe(false);
    expect(['games', 'ai', 'news', 'marketplace'].every((m) => p.isModuleAllowed(m as never))).toBe(true);
  });

  it('PB: turning on needs explicit acknowledgement of the scope and a PIN, and gives a one-time recovery code', () => {
    const { p } = setup();
    expect(() => p.setup({ pin: '2468', acknowledged: false })).toThrow(/Read what these controls can and cannot do/);
    expect(() => p.setup({ pin: '12', acknowledged: true })).toThrow(/at least 4/);
    const { recoveryCode } = on(p);
    expect(recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(p.status(linux).enabled).toBe(true);
    expect(() => on(p)).toThrow(/already on/);
  });

  it('PC: status reports what is active, including the scope of each control (shown as indicators in the app)', () => {
    const { p } = setup();
    on(p, { copyRestriction: true, tutorMode: true });
    const s = p.status(linux);
    expect(s.config).toMatchObject({ copyRestriction: true, tutorMode: true });
    expect(s.platform.copyRestriction.scope).toMatch(/inside FlowCompanion/);
    expect(s.configuredAt).toBe('2026-10-20T15:00:00.000Z');
  });

  it('PD: copy restriction blocks copying AI answers only', () => {
    const { p } = setup();
    on(p, { copyRestriction: true });
    expect(p.copyBlockedReason('ai')).toMatch(/Copying AI answers is turned off/);
    for (const c of ['notes', 'prompts', 'learning', 'marketplace', 'general'] as const) expect(p.copyBlockedReason(c)).toBeNull();
    p.updateConfig('2468', { copyRestriction: false });
    expect(p.copyBlockedReason('ai')).toBeNull();
  });

  it('PE: the copy restriction does not claim to control other apps, websites or screenshots', () => {
    const { p } = setup();
    on(p);
    const s = p.status(mac);
    expect(s.platform.copyRestriction.scope).toMatch(/does not apply to other apps or websites/);
    expect(s.platform.copyRestriction.scope).toMatch(/cannot stop screenshots/);
    expect(s.platform.otherAppsAndWebsites).toMatchObject({ supported: false });
  });

  it('PF: screen-capture privacy is reported as active only where the OS supports it', () => {
    expect(contentProtectionSupport('linux', '6.1').supported).toBe(false);
    expect(contentProtectionSupport('darwin', '24.0')).toMatchObject({ supported: true, detail: expect.stringMatching(/may still record/) });
    expect(contentProtectionSupport('win32', '10.0.19045').detail).toMatch(/exclude FlowCompanion windows/);
    expect(contentProtectionSupport('win32', '10.0.17763').detail).toMatch(/appear black/);
    const { p } = setup();
    on(p, { screenCapturePrivacy: true });
    expect(p.wantsContentProtection()).toBe(true);
    expect(p.status(linux).platform.screenCapturePrivacy).toMatchObject({ supported: false, applied: false });
    expect(p.status(mac).platform.screenCapturePrivacy).toMatchObject({ supported: true, applied: true });
  });

  it('PG: no covert monitoring — no keystroke logging or screen inspection code exists', () => {
    const roots = ['src/main', 'src/core', 'src/preload', 'src/renderer'];
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.(ts|tsx)$/.test(f)) files.push(f);
      }
    };
    roots.forEach(walk);
    const all = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    expect(all).not.toMatch(/desktopCapturer|getDisplayMedia|uiohook|iohook|keylogger|captureScreen/);
    // The only data parental controls store are settings and session start/end times.
    const { db, p } = setup();
    on(p);
    p.startSession('2468', { goal: 'Algebra', minutes: 30 });
    expect(Object.keys(db.get('SELECT * FROM study_sessions')!).sort()).toEqual(['allowed_modules', 'ended_at', 'ended_by', 'ends_at', 'goal', 'id', 'started_at']);
  });

  it('PH: changes need the PIN, wrong PINs are refused, and repeated failures lock with increasing delays', () => {
    const { p, clock } = setup();
    on(p);
    expect(() => p.updateConfig('0000', { tutorMode: false })).toThrow(/Wrong PIN. 4 attempts left/);
    for (let i = 0; i < 3; i++) expect(() => p.updateConfig('0000', {})).toThrow(/Wrong PIN/);
    expect(() => p.updateConfig('0000', {})).toThrow(/Locked for 5 minutes/);
    expect(() => p.updateConfig('2468', { tutorMode: false })).toThrow(/Try again in 5 minutes/);
    expect(p.status(linux).lockedUntil).toBe('2026-10-20T15:05:00.000Z');
    clock.advanceMinutes(5);
    for (let i = 0; i < 4; i++) expect(() => p.updateConfig('9999', {})).toThrow(/Wrong PIN/);
    expect(() => p.updateConfig('9999', {})).toThrow(/Locked for 10 minutes/);
    clock.advanceMinutes(10);
    expect(p.updateConfig('2468', { tutorMode: false }).tutorMode).toBe(false);
    expect(p.status(linux).failedAttempts).toBe(0);
  });

  it('PI: turning off with the PIN removes every restriction and ends any session', () => {
    const { p } = setup();
    on(p, { hideGamesOutsideSessions: true, screenCapturePrivacy: true });
    p.startSession('2468', { goal: 'Reading', minutes: 20, allowedModules: ['learning'] });
    expect(() => p.disable('1111')).toThrow(/Wrong PIN/);
    p.disable('2468');
    expect(p.status(linux)).toMatchObject({ enabled: false, session: null });
    expect(p.isModuleAllowed('games')).toBe(true);
    expect(p.copyBlockedReason('ai')).toBeNull();
    expect(p.wantsContentProtection()).toBe(false);
    expect(p.recentSessions()[0]).toMatchObject({ endedBy: 'parent' });
  });

  it('PJ: a forgotten PIN can be reset with the recovery code, which then changes', () => {
    const { p } = setup();
    const { recoveryCode } = on(p);
    expect(() => p.recover('AAAA-BBBB-CCCC-DDDD', '1357')).toThrow(/Wrong recovery code/);
    const next = p.recover(recoveryCode.toLowerCase().replace(/-/g, ' '), '1357');
    expect(next.recoveryCode).not.toBe(recoveryCode);
    expect(() => p.updateConfig('2468', {})).toThrow(/Wrong PIN/);
    expect(p.updateConfig('1357', { tutorMode: false }).tutorMode).toBe(false);
    expect(() => p.recover(recoveryCode, '0000')).toThrow(/Wrong recovery code/);
  });

  it('PK: a supervised session limits the app to the chosen sections (plus Home and Settings)', () => {
    const { p } = setup();
    on(p);
    expect(() => p.startSession('2468', { goal: 'x', minutes: 2 })).toThrow(/5 minutes/);
    const s = p.startSession('2468', { goal: 'Fractions homework', minutes: 45, allowedModules: ['learning', 'notes'] });
    expect(s).toMatchObject({ goal: 'Fractions homework', endsAt: '2026-10-20T15:45:00.000Z', allowedModules: ['learning', 'notes'] });
    expect(p.isModuleAllowed('learning')).toBe(true);
    expect(p.isModuleAllowed('home')).toBe(true);
    expect(p.isModuleAllowed('settings')).toBe(true);
    expect(p.isModuleAllowed('ai')).toBe(false);
    expect(p.isModuleAllowed('games')).toBe(false);
    expect(() => p.startSession('2468', { goal: 'again', minutes: 10 })).toThrow(/already running/);
  });

  it('PL: sessions end on time, even if the app was closed; ending early needs the PIN', () => {
    const { p, clock, reopen } = setup();
    on(p);
    p.startSession('2468', { goal: 'Essay plan', minutes: 30, allowedModules: ['notes'] });
    expect(() => p.endSession('0000')).toThrow(/Wrong PIN/);
    expect(p.nextSessionEnd()?.toISOString()).toBe('2026-10-20T15:30:00.000Z');
    clock.advanceMinutes(45); // app was closed past the end time
    const again = reopen();
    expect(again.activeSession()).toBeNull();
    expect(again.isModuleAllowed('ai')).toBe(true);
    expect(again.completeDueSession()).toMatchObject({ endedBy: 'timer', endedAt: '2026-10-20T15:30:00.000Z' });
    expect(again.completeDueSession()).toBeNull();
    again.startSession('2468', { goal: 'Short', minutes: 10 });
    expect(again.endSession('2468')).toMatchObject({ endedBy: 'parent' });
  });

  it('PM: settings, PIN and an active session survive a restart', () => {
    const { p, reopen } = setup();
    on(p, { tutorMode: true, hideGamesOutsideSessions: true });
    p.startSession('2468', { goal: 'Revision', minutes: 60, allowedModules: ['learning'] });
    const after = reopen();
    expect(after.status(linux)).toMatchObject({ enabled: true, config: { hideGamesOutsideSessions: true }, session: { goal: 'Revision' } });
    expect(after.tutorPrompt()).toBe(TUTOR_PROMPT);
    expect(() => after.updateConfig('2468', {})).not.toThrow();
  });

  it('PN: tutor mode changes how the AI answers by adding tutoring instructions', () => {
    const { p } = setup();
    on(p, { tutorMode: true });
    expect(p.tutorPrompt()).toMatch(/Do not write complete essays, assignments, homework answers or test answers/);
    p.updateConfig('2468', { tutorMode: false });
    expect(p.tutorPrompt()).toBeNull();
  });

  it('PO: games can be locked outside sessions; invalid settings are rejected rather than silently applied', () => {
    const { p } = setup();
    on(p, { hideGamesOutsideSessions: true });
    expect(p.isModuleAllowed('games')).toBe(false);
    expect(p.isModuleAllowed('notes')).toBe(true);
    expect(() => p.updateConfig('2468', { sessionAllowedModules: ['not-a-module'] as never })).toThrow();
    expect(p.config().hideGamesOutsideSessions).toBe(true);
  });
});
