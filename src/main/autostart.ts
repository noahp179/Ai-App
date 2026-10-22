import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LINUX_FILE = path.join(os.homedir(), '.config', 'autostart', 'flowcompanion.desktop');

function linuxExec(): string {
  const quote = (s: string) => `"${s.replace(/(["\\$`])/g, '\\$1')}"`;
  if (process.env.APPIMAGE) return quote(process.env.APPIMAGE);
  if (app.isPackaged) return quote(process.execPath);
  return `${quote(process.execPath)} ${quote(app.getAppPath())}`;
}

/** Applies the "launch at login" preference. Returns an error message, or null on success. */
export function applyLaunchAtLogin(enabled: boolean): string | null {
  try {
    if (process.platform === 'linux') {
      if (enabled) {
        fs.mkdirSync(path.dirname(LINUX_FILE), { recursive: true });
        fs.writeFileSync(
          LINUX_FILE,
          ['[Desktop Entry]', 'Type=Application', 'Name=FlowCompanion', `Exec=${linuxExec()} --hidden`, 'X-GNOME-Autostart-enabled=true', 'NoDisplay=false', ''].join('\n'),
        );
      } else if (fs.existsSync(LINUX_FILE)) {
        fs.rmSync(LINUX_FILE);
      }
      return null;
    }
    app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export function launchAtLoginActive(): boolean {
  if (process.platform === 'linux') return fs.existsSync(LINUX_FILE);
  return app.getLoginItemSettings().openAtLogin;
}
