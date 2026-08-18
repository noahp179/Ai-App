/**
 * Preload bridge.
 *
 * The renderer is the same web bundle the mobile app builds, so it must run
 * unchanged in a browser. This exposes a single narrow, optional API that the
 * web build feature-detects: `window.synapse` is present on desktop and absent
 * everywhere else.
 *
 * Only menu-driven navigation events cross the bridge. No filesystem, no shell,
 * no Node APIs — anything more would undo the sandbox above it.
 */

import { contextBridge, ipcRenderer } from 'electron';

/** The menu commands the main process can send. Nothing else is forwarded. */
const CHANNELS = [
  'synapse:continue-lesson',
  'synapse:start-review',
  'synapse:navigate-catalog',
  'synapse:navigate-lab',
  'synapse:navigate-settings',
] as const;

type Channel = (typeof CHANNELS)[number];

contextBridge.exposeInMainWorld('synapse', {
  platform: 'macos' as const,

  /**
   * Subscribes to a menu command. Returns an unsubscribe function.
   * An unrecognised channel is ignored rather than wired up.
   */
  onMenuCommand(channel: Channel, handler: () => void): () => void {
    if (!CHANNELS.includes(channel)) return () => {};

    const listener = (): void => handler();
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
});
