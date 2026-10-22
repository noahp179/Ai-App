import { BrowserWindow, app, dialog } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SaveResult } from '../shared/api';
import { UserError } from '../core/util';

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

function parent(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

/** Asks where to save and writes the file. Nothing is written if the user cancels. */
export async function saveFile(filename: string, content: string, filters: Electron.FileFilter[]): Promise<SaveResult> {
  const win = parent();
  const opts: Electron.SaveDialogOptions = { defaultPath: path.join(app.getPath('documents'), filename), filters };
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
  if (r.canceled || !r.filePath) return { saved: false, path: null };
  await fs.writeFile(r.filePath, content, 'utf8');
  return { saved: true, path: r.filePath };
}

/** Asks for files to import and reads them as text, refusing anything too large. */
export async function openTextFiles(filters: Electron.FileFilter[], multi = true): Promise<{ name: string; content: string }[] | null> {
  const win = parent();
  const opts: Electron.OpenDialogOptions = { properties: multi ? ['openFile', 'multiSelections'] : ['openFile'], filters };
  const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  if (r.canceled || r.filePaths.length === 0) return null;
  const out: { name: string; content: string }[] = [];
  for (const p of r.filePaths.slice(0, 5000)) {
    const st = await fs.stat(p);
    if (st.size > MAX_IMPORT_BYTES) throw new UserError(`${path.basename(p)} is larger than 20 MB and was not imported.`);
    out.push({ name: path.basename(p), content: await fs.readFile(p, 'utf8') });
  }
  return out;
}

export function parseJsonFile(name: string, content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new UserError(`${name} is not valid JSON. Nothing was imported.`);
  }
}
