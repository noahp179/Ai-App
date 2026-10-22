import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { EVENT_CHANNEL, INVOKE_CHANNEL, type AppEventMessage, type PreloadBridge } from '../shared/ipc';

const bridge: PreloadBridge = {
  invoke: (method, args) => ipcRenderer.invoke(INVOKE_CHANNEL, method, args),
  onEvent: (listener) => {
    const handler = (_e: IpcRendererEvent, message: AppEventMessage) => listener(message);
    ipcRenderer.on(EVENT_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(EVENT_CHANNEL, handler);
    };
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('fc', bridge);
