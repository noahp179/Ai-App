# Settings reference

All settings live in Settings and take effect immediately (no restart), persist across restarts, and are validated: an invalid stored value is repaired to its default on load and reported. Defaults are shown in brackets.

## App

| Setting | Effect |
| --- | --- |
| **Mode** [personal] | Personal, Student, Creator, Advanced, Parent-managed, Educator. Applies a preset of visible sections; you can change sections afterwards. Does not establish age or parental authority. |
| **Theme** [dark] · **Accent** [indigo] · **Text size** [100%] · **Density** [comfortable] · **High contrast** [off] | Applied to every window instantly. |
| **Reduce motion** [follow system] | Removes animations (also in games). |
| **Sections shown** [all] | Hides/shows each module in navigation, search and the command palette. Hidden modules keep their data. |
| **Open to** [Home] · **Collapse sidebar** · **Distraction-free** (Ctrl/Cmd+Shift+D) | Layout. |
| **Floating companion**: enabled [on], show on startup [off], always on top [on], opacity [100%], dock [floating] | Controls the companion window. |
| **Launch at login** [off] · **Start hidden** [off] · **Close to tray** [off] | Uses the OS login items (macOS/Windows) or `~/.config/autostart` (Linux). Errors are shown, not hidden. |
| **Keyboard shortcuts**: enabled [on]; toggle companion [Ctrl/Cmd+Shift+Space], quick capture [Ctrl/Cmd+Shift+K], show main window [Ctrl/Cmd+Shift+F] | Global shortcuts; the screen shows which ones the OS refused (already taken). |
| **Notifications**: enabled [on], sound [on], quiet hours [off, 22:00–07:00], default reminder [10 min], snooze [10 min], missed-reminder window [12 h] | OS notifications through the main process. During quiet hours notifications go to the in-app inbox silently. Reminders older than the window after a restart are marked missed instead of shown. |

## Features

| Setting | Effect |
| --- | --- |
| **AI**: default provider, global system instructions, streaming [on], store conversations [on], delete after N days [never], request timeout [120 s], max output tokens [provider default], temperature [provider default], notify when a reply finishes in the background [on] | Applied to every request. With "store conversations" off, new chats are temporary: they are kept while the app runs and deleted at the next start. Claude requests never send a temperature. |
| **Notes**: default format [Markdown], autosave delay [0.8 s], spellcheck [on], show preview [on], trash retention [30 days] | |
| **Productivity**: focus [25], short break [5], long break [15] minutes, long break every [4], auto-start breaks [off] | Focus timer. |
| **Calendar**: time zone [system], week starts [Monday], default view [week], default event length [60 min], day starts at [07:00], time format [auto] | Event times are stored in their own zone and shown in this one; DST-safe. |
| **Learning**: goals, preferred level [any], study reminder [10 min before] | Suggestions follow goals and level when personalization is on; reminder applies to scheduled study time. |
| **News**: topics [AI, technology, science], refresh every [60 min], preview length [220], keyword alerts [on], hide read [off] | |
| **Marketplace**: server address [none], show paid listings [on], trial reminders [on] | Changing the server signs you out of the previous one. |
| **Browser**: bridge [off], port [47823] | Starts/stops the loopback bridge for the extension. |
| **Parental Learning Controls** [off] | Copy blocking, tutor mode, study sessions, screen-capture privacy, and **locked sections** (lock any section such as News, Games or the Marketplace). See [PARENTAL_CONTROLS.md](PARENTAL_CONTROLS.md). Changes need the parent PIN. |

## Privacy & data

| Setting | Effect |
| --- | --- |
| **Personalize suggestions** [on] | Uses your chosen goals and topics. Off: everyone gets the same starting points. |
| **Use my activity** [off] | Learning suggestions may use your progress and saved items. |
| **Use my AI conversations** [off] | Separate consent: Learning Hub suggestions may use the titles of recent conversations, matched locally. |
| **Ask before sending attached notes, tasks or events** [on] | Shows exactly what will be sent and to which provider before an AI request with attachments. |
| **Backups to keep** [5] | Automatic backups before migrations and on demand. |
| Export everything / Restore a backup / Delete everything | See [PRIVACY.md](PRIVACY.md). |
