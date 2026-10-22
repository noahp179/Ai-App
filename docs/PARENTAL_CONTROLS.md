# Parental Learning Controls

Optional tools for a parent or guardian who is helping a young person learn with FlowCompanion. **Off by default.** They are turned on only in Settings → Parental Learning Controls, after the screen explains what they can and cannot do, the parent confirms, and a PIN is set.

## What they do

| Control | How it works | Where it applies |
| --- | --- | --- |
| **Block copying AI answers** | Copy buttons are hidden, keyboard copy/cut and dragging from AI answers are blocked in the page, text selection is disabled on answers, and the main process refuses clipboard writes in the AI context. | FlowCompanion's AI workspace and floating companion only |
| **Tutor mode** | Adds instructions to every AI request asking the assistant to teach with hints and questions and not to write finished homework, essays or test answers. | All AI providers used through FlowCompanion. The model may not always comply. |
| **Supervised study sessions** | For a set time (5 min–8 h), only the chosen sections plus Home and Settings open; others show a "paused" screen. The AI tab in the companion is hidden if AI is not included. The session ends on time even if the app was closed, and ending early needs the PIN. A banner shows the goal and time left. | FlowCompanion only |
| **Lock games outside sessions** | Games open only in sessions that include them. | FlowCompanion only |
| **Screen-capture privacy (best effort)** | Asks the OS to exclude FlowCompanion windows from screenshots and recordings using Electron's documented `setContentProtection`. | macOS and Windows: requested from the OS (some capture methods may still record; Windows before 10 2004 shows a black window instead). **Linux: not available** and never shown as active. |

A banner at the top of FlowCompanion says the controls are on and lists the active ones, so nothing is hidden from the person using the app.

## What they do not do

- No monitoring: no keystroke logging, screenshots, screen inspection, browsing history or message reading. The only records are session goal, sections and start/end times.
- No control over other apps or websites, including AI websites. The browser extension does not enforce these controls.
- They cannot stop a photo of the screen, retyping, or another device.
- Someone with administrator access to the computer, or who can edit FlowCompanion's data folder, can remove them. They support learning; they are not tamper-proof security software.
- Choosing the Student or Parent-managed mode does not verify anyone's age or parental authority.

## PIN, lockout and recovery

- PIN or passphrase of 4–64 characters, stored only as a salted scrypt hash.
- 5 wrong attempts lock PIN actions for 5 minutes; each further lockout doubles the wait, up to 1 hour.
- At setup a one-time recovery code (`XXXX-XXXX-XXXX-XXXX`) is shown. It resets the PIN and is then replaced by a new code. It is stored only as a hash.
- Turning the controls off needs the PIN and removes every restriction immediately.

## Per-platform capability

| | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Copy restriction (in FlowCompanion) | Yes | Yes | Yes (verified) |
| Tutor mode | Yes | Yes | Yes (verified) |
| Supervised sessions | Yes | Yes | Yes (verified) |
| Screen-capture privacy | Requested via display affinity — not verified on Windows | Requested via window sharing type — not verified on macOS | Not available |

## Acceptance tests PA–PO

The brief asked to keep the original parental-control acceptance tests PA–PO, but their wording was not included in it. These tests were therefore derived from the brief's section 23 requirements, adapted to this implementation, and automated in `tests/unit/parental.test.ts` (service level) and `tests/e2e/parental.spec.ts` (in the real app).

| ID | Requirement | Automated in |
| --- | --- | --- |
| PA | Everything off by default | unit + e2e |
| PB | Scope explained, explicit confirmation and PIN, one-time recovery code | unit + e2e |
| PC | Visible status indicator while on | unit (status) + e2e (banner) |
| PD | Copying AI answers blocked; other content unaffected | unit + e2e |
| PE | No claim of control over other apps, websites or screenshots | unit (status text) + e2e (scope screen) |
| PF | Screen-capture privacy only reported active where supported; Linux reported unavailable | unit (all OS rules) + e2e (Linux) |
| PG | No covert monitoring code; only session times stored | unit (source scan + schema) |
| PH | PIN required; wrong PIN refused; escalating lockout | unit + e2e (wrong PIN) |
| PI | Turning off with the PIN removes all restrictions | unit + e2e |
| PJ | Recovery code resets PIN and is replaced | unit |
| PK | Sessions limit sections to the chosen ones plus Home/Settings | unit + e2e |
| PL | Sessions end on time even across restarts; ending early needs the PIN | unit + e2e |
| PM | Settings and active sessions persist across restarts | unit + e2e |
| PN | Tutor mode changes AI requests | unit (+ AI integration test of the extra system prompt) |
| PO | Games lock outside sessions; invalid settings rejected | unit |

Not executed: screen-capture privacy on real Windows and macOS machines.
