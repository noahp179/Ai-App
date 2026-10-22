# Privacy and data flows

FlowCompanion is local-first. There is **no telemetry, no analytics, no crash reporting and no FlowCompanion account**. Nothing is sent anywhere unless you set up a feature that needs it, and each such flow is listed below.

## Where data lives

Everything is in one SQLite database (`flowcompanion.db`) in the app's user-data folder, plus automatic backups next to it (`backups/`, newest 5 by default). Settings → Data and backups shows the folder, a plain-language inventory of every table with row counts, export, restore and delete.

| Data | Table(s) | Notes |
| --- | --- | --- |
| Notes, folders, tags, drafts | `notes`, `folders`, `note_drafts` | Drafts are crash-recovery copies, removed once saved |
| Tasks, bookmarks, reading queue, time entries, focus sessions | `tasks`, `bookmarks`, `time_entries`, `focus_sessions` | Bookmarked pages are never fetched |
| Calendar events, reminders, notifications | `events`, `reminders`, `inbox`, `notification_log` | Log pruned after 30 days |
| AI providers, conversations, messages, task status | `providers`, `conversations`, `messages`, `ai_tasks` | API keys are **not** in these tables |
| News sources, cached items, alerts | `feed_sources`, `feed_items`, `feed_alerts` | Titles and short previews only |
| Game scores, saved games | `game_scores`, `game_state` | |
| Learning progress and notes | `learning_progress` | |
| Prompts, versions, listings, reviews, reports, trials | `prompts`, `prompt_versions`, `listings`, `listing_versions`, `reviews`, `abuse_reports`, `entitlements`, `listing_events` | `listing_events` counts *your own* views/copies on this device |
| Parental controls | `kv` (`parental:state`), `study_sessions` | PIN and recovery code stored only as scrypt hashes; sessions store goal, sections, start/end times — nothing else |
| Browser bridge pairings | `kv` (`bridge:clients`) | Tokens stored only as SHA-256 hashes |
| Secrets (API keys, marketplace sign-in) | `secrets` | Encrypted by the OS (Keychain, DPAPI, libsecret/kwallet). If the OS offers no real encryption, secrets are kept in memory for the session only and never written to disk; the UI tells you. |

## What leaves your computer, and when

| Flow | Sent to | What is sent | When |
| --- | --- | --- | --- |
| AI requests | The provider **you** configure (OpenAI, Anthropic, Google, an OpenAI-compatible server, Ollama) | The conversation's messages, system instructions, any notes/tasks/events you attach (with a confirmation showing exactly what will be sent, on by default), your API key as the provider requires | Only when you press Send or Retry |
| News feeds | Each enabled feed's publisher | A normal HTTP request with a `FlowCompanion/<version>` user agent and cache headers | On refresh (hourly by default, configurable, or manual) |
| Opening links | Your default browser | The link | When you click |
| Marketplace server (optional) | The server address **you** enter | Your email/password when signing in (password never stored), listing searches, listing views, trials, reviews and reports you submit, listings you publish | Only after you configure a server; browsing works without an account |
| Browser extension (optional) | FlowCompanion on this computer only (127.0.0.1) | Page title and URL, or the text you selected | Only when you click an extension action |

Not sent anywhere: your notes, tasks, calendar, learning progress, game scores, prompt library, personalization signals, parental-control settings or study sessions.

## Personalization and consent

Personalization has separate switches (Settings → Privacy):

- **Personalize suggestions** (on): uses the goals and interests you choose (learning goals, news topics). Turning it off gives everyone the same starting points.
- **Use my activity** (off by default): lets learning suggestions use your saved items and progress.
- **Use my AI conversations** (off by default, separate consent): lets Learning Hub suggestions consider the *titles* of your recent conversations. Matching happens on this computer.

All of this runs locally; there is no profiling on any server.

## Your controls

- **Export**: Settings → Data and backups → Export everything (JSON, excludes secrets). Notes, prompts, learning data and the calendar (ICS) also have their own exports.
- **Delete**: per item, per module (e.g. "Delete learning data", "Reset game scores"), or everything (type `DELETE`), which removes the database and backups and restarts the app.
- **Retention**: AI conversation retention and note trash retention are configurable.

## Children and parental controls

Parental Learning Controls are off by default, need an explicit setup by a parent, show a visible banner while on, and do not monitor or record activity. See [PARENTAL_CONTROLS.md](PARENTAL_CONTROLS.md).
