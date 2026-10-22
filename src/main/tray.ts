import { Menu, Tray, nativeImage } from 'electron';
import fs from 'node:fs';

export interface TrayActions {
  openMain: () => void;
  toggleCompanion: () => void;
  quickCapture: () => void;
  newChat: () => void;
  startFocus: () => void;
  togglePauseNotifications: () => void;
  notificationsPaused: () => boolean;
  quit: () => void;
}

export class AppTray {
  private tray: Tray | null = null;

  constructor(
    private readonly iconPath: string,
    private readonly actions: TrayActions,
  ) {}

  /** Returns false when the platform refused to create a tray icon. */
  create(): boolean {
    try {
      const img = fs.existsSync(this.iconPath) ? nativeImage.createFromPath(this.iconPath) : nativeImage.createEmpty();
      const sized = img.isEmpty() ? img : img.resize({ width: process.platform === 'darwin' ? 18 : 22 });
      if (process.platform === 'darwin') sized.setTemplateImage(true);
      this.tray = new Tray(sized);
      this.tray.setToolTip('FlowCompanion');
      this.tray.on('click', () => this.actions.toggleCompanion());
      this.refresh();
      return true;
    } catch (err) {
      console.warn('tray unavailable', err);
      this.tray = null;
      return false;
    }
  }

  get available(): boolean {
    return this.tray !== null;
  }

  refresh(): void {
    if (!this.tray) return;
    const a = this.actions;
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open FlowCompanion', click: a.openMain },
        { label: 'Show or hide companion', click: a.toggleCompanion },
        { type: 'separator' },
        { label: 'Quick capture…', click: a.quickCapture },
        { label: 'New AI chat', click: a.newChat },
        { label: 'Start focus session', click: a.startFocus },
        { type: 'separator' },
        {
          label: a.notificationsPaused() ? 'Resume notifications' : 'Pause notifications for 1 hour',
          click: () => {
            a.togglePauseNotifications();
            this.refresh();
          },
        },
        { type: 'separator' },
        { label: 'Quit FlowCompanion', click: a.quit },
      ]),
    );
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
