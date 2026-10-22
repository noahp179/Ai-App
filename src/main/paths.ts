import { app } from 'electron';
import path from 'node:path';

/** Resolves where FlowCompanion keeps its data. FC_USER_DATA_DIR overrides it (tests, portable use). */
export function resolvePaths() {
  const override = process.env.FC_USER_DATA_DIR;
  if (override) app.setPath('userData', path.resolve(override));
  const dataDir = app.getPath('userData');
  return {
    dataDir,
    dbPath: path.join(dataDir, 'flowcompanion.db'),
    backupDir: path.join(dataDir, 'backups'),
    exportDir: app.getPath('documents'),
    rendererDir: path.join(__dirname, '..', 'renderer'),
    preloadPath: path.join(__dirname, '..', 'preload', 'index.js'),
    iconPath: path.join(__dirname, '..', '..', 'resources', 'icon.png'),
    trayIconPath: path.join(__dirname, '..', '..', 'resources', 'tray.png'),
  };
}

export type AppPaths = ReturnType<typeof resolvePaths>;
