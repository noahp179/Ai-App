# Installing and configuring FlowCompanion

## Packages

| OS | Package | State |
| --- | --- | --- |
| Linux x64 | `FlowCompanion-1.0.0.AppImage`, `flowcompanion_1.0.0_amd64.deb` | Built and launched on Linux in the development environment |
| Windows x64 | `FlowCompanion-1.0.0-win.zip` (portable folder) | Cross-built on Linux, **unsigned, never run on Windows**. The NSIS installer needs Windows (or Wine) to build; the CI workflow builds it on a Windows runner. |
| macOS x64 | `FlowCompanion-1.0.0-mac.zip` (`.app`) | Cross-built on Linux, **unsigned and not notarised, never run on macOS**. A `.dmg` must be built on macOS (CI workflow). |

Packages are produced by `npm run dist:linux` / `dist:win` / `dist:mac` into `release/`. They are not published anywhere yet.

### Linux

- **AppImage**: `chmod +x FlowCompanion-1.0.0.AppImage && ./FlowCompanion-1.0.0.AppImage`. On Ubuntu 24.04+, AppArmor blocks Electron's sandbox for AppImages; either install the `.deb` (which installs an AppArmor profile) or run with `--no-sandbox` (less safe).
- **deb**: `sudo apt install ./flowcompanion_1.0.0_amd64.deb`, then start "FlowCompanion" from the app menu.

### Windows (unsigned build)

Unzip anywhere and run `FlowCompanion.exe`. SmartScreen will warn because the build is not signed. The executable has no embedded icon or version information in this cross-built zip.

### macOS (unsigned build)

Unzip and move `FlowCompanion.app` to Applications. Because it is not signed or notarised, macOS will refuse to open it normally; right-click → Open, or remove the quarantine flag (`xattr -dr com.apple.quarantine /Applications/FlowCompanion.app`). This build is x64 only (runs under Rosetta on Apple Silicon).

## First run

FlowCompanion opens on Home. Everything works offline. Optional set-up:

1. **Choose a mode** (Settings → General): personal, student, creator, advanced, parent-managed or educator. Modes only change which sections are shown; you can change them any time.
2. **Connect an AI provider** (AI Workspace → Connect a provider, or Settings → AI providers).
3. **Pick news topics** (News → follow topics) and **learning goals** (Settings → Learning).

## AI providers

| Provider | What you need |
| --- | --- |
| OpenAI | An API key from platform.openai.com (billed by OpenAI). |
| Anthropic Claude | An API key from the Claude Console (billed by Anthropic). Default model `claude-opus-5-5`; Sonnet 5.5, Haiku 5.5 and Fable 5.1 are offered. When the endpoint is api.anthropic.com, FlowCompanion turns on Anthropic's server-side fallback for refusals on supported models; you can switch it off per provider. |
| Google Gemini | An API key from Google AI Studio. |
| Ollama | Ollama running locally (`http://127.0.0.1:11434`). No key. |
| OpenAI-compatible | Any server exposing `/v1/chat/completions`: llama.cpp `llama-server`, LM Studio, vLLM, LocalAI… Enter its base URL (e.g. `http://127.0.0.1:8080/v1`) and a key if it needs one. |

Keys are stored with the operating system's secure storage (Keychain, Windows DPAPI, GNOME libsecret/KWallet). If none is available — common on minimal Linux setups — the key is kept only until you quit, and the provider screen says so. FlowCompanion never asks for your AI account password.

### Running a local model (no account)

```bash
# llama.cpp
llama-server -m qwen2.5-0.5b-instruct-q4_k_m.gguf --port 8080
# then add an "OpenAI-compatible" provider with base URL http://127.0.0.1:8080/v1
```

or install Ollama, `ollama pull llama3.2`, and add an Ollama provider.

## Marketplace server (optional)

The desktop app includes free starter prompts without any server. To try community listings, accounts, reviews and trials, run the reference server:

```bash
npm ci
FC_MARKET_ADMIN_EMAIL=you@example.org npm run server -- --port 8787 --db ./marketplace.db --seed-demo
```

Then in FlowCompanion: Settings → Marketplace → server `http://127.0.0.1:8787` → Create account (the email in `FC_MARKET_ADMIN_EMAIL` becomes a moderator). `--seed-demo` adds three listings clearly labelled "Demo". For a shared deployment, put the server behind a TLS reverse proxy (the app only accepts `https://` for non-local servers) and back up the database file. Payments are not implemented; purchase requests return "Payments are not set up".

Environment variables: `PORT`, `FC_MARKET_DB`, `FC_MARKET_ADMIN_EMAIL`, `FC_MARKET_REGISTRATION=closed`.

## Browser extension (optional)

1. Settings → Browser → turn on **Browser bridge** → **Open extension folder**.
2. In Chrome/Edge/Brave: `chrome://extensions` → Developer mode → **Load unpacked** → choose that folder.
3. Settings → Browser → **Pair a browser**, then type the code into the extension popup.

## Where your data is

- Linux: `~/.config/FlowCompanion/`
- Windows: `%APPDATA%\FlowCompanion\`
- macOS: `~/Library/Application Support/FlowCompanion/`

Set `FC_USER_DATA_DIR=/some/folder` to use another location (portable use, testing).

## Uninstalling

Remove the app as usual for your OS. Your data folder is kept unless you delete it (or use Settings → Data and backups → Delete everything first).
