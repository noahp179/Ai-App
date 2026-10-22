import { Notification, safeStorage } from 'electron';
import type { Cipher } from '../core/secrets';
import type { Capabilities } from '../shared/types';

const platform = process.platform;

function linuxBackend(): string {
  try {
    return safeStorage.getSelectedStorageBackend();
  } catch {
    return 'unknown';
  }
}

/** Whether safeStorage is backed by a real OS secret store (not the Linux plaintext fallback). */
export function secureStorageInfo(): Capabilities['secureStorage'] {
  const available = safeStorage.isEncryptionAvailable();
  if (platform === 'darwin') {
    return { available, backend: 'macOS Keychain', detail: available ? 'Keys are encrypted with a key held in the macOS Keychain.' : 'Keychain access is unavailable.' };
  }
  if (platform === 'win32') {
    return { available, backend: 'Windows DPAPI', detail: available ? 'Keys are encrypted with Windows DPAPI for your user account.' : 'DPAPI is unavailable.' };
  }
  const backend = linuxBackend();
  const weak = backend === 'basic_text' || backend === 'unknown';
  return {
    available: available && !weak,
    backend,
    detail: weak
      ? 'No system keyring (GNOME Keyring / KWallet) was found. API keys are kept in memory for this session only and must be re-entered after a restart.'
      : `Keys are encrypted with the system keyring (${backend}).`,
  };
}

export const safeStorageCipher: Cipher = {
  isSecure: () => secureStorageInfo().available,
  encrypt: (plain) => safeStorage.encryptString(plain),
  decrypt: (data) => safeStorage.decryptString(Buffer.from(data)),
};

export function detectCapabilities(traySupported: boolean): Capabilities {
  const wayland = platform === 'linux' && (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY);
  return {
    secureStorage: secureStorageInfo(),
    notifications: {
      supported: Notification.isSupported(),
      detail: Notification.isSupported()
        ? 'System notifications are available. Your OS may still block them in its own settings.'
        : 'This system does not support notifications. Reminders appear in the in-app inbox only.',
    },
    tray: {
      supported: traySupported,
      detail: traySupported
        ? platform === 'darwin'
          ? 'Menu bar icon available.'
          : 'Tray icon available.'
        : 'No tray or status area was found. Close-to-tray and start-hidden are unavailable.',
    },
    contentProtection: {
      supported: platform === 'darwin' || platform === 'win32',
      detail:
        platform === 'win32'
          ? 'Uses SetWindowDisplayAffinity. Windows 10 2004+ hides the window from captures; older versions show it as black. Not every capture method honours it.'
          : platform === 'darwin'
            ? 'Uses NSWindow sharingType = none. Some capture tools on recent macOS versions do not honour it.'
            : 'Linux has no supported API to exclude a window from screen capture.',
    },
    windowOpacity: {
      supported: platform === 'darwin' || platform === 'win32',
      detail: platform === 'linux' ? 'Window transparency is not supported by Electron on Linux.' : 'Supported.',
    },
    launchAtLogin: {
      supported: true,
      detail:
        platform === 'linux'
          ? 'Adds an XDG autostart entry (~/.config/autostart). Works with most desktop environments.'
          : 'Uses the operating system login items.',
    },
    globalShortcuts: {
      supported: !wayland,
      detail: wayland
        ? 'Wayland sessions do not allow apps to register global shortcuts. Use the in-app shortcuts or the tray menu.'
        : 'Global shortcuts work while FlowCompanion is running.',
    },
  };
}
