import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { PreloadBridge } from '../shared/ipc';
import { ConfirmProvider, PromptProvider, ToastProvider } from '../renderer/components/ui';
import { ClassroomApp } from '../renderer/modules/classroom/ClassroomApp';
import { webTransport } from './transport';
import '../renderer/styles/global.css';

/**
 * The classroom in a browser (for Chromebooks and school computers without the desktop app). It is the same
 * React code as the desktop Classroom section. A few shared components call the desktop app's bridge; in the
 * browser that bridge only opens links, and everything else reports that it is not available here.
 */
const bridge: PreloadBridge = {
  async invoke(method, args) {
    if (method === 'app.openExternal' && typeof args[0] === 'string' && /^https?:\/\//.test(args[0])) {
      window.open(args[0], '_blank', 'noopener,noreferrer');
      return { ok: true, value: undefined };
    }
    return { ok: false, error: { code: 'unavailable', message: 'Not available in the browser version.' } };
  },
  onEvent: () => () => undefined,
  platform: 'web',
};
window.fc = bridge;

const dark = window.matchMedia?.('(prefers-color-scheme: dark)');
const theme = () => document.documentElement.setAttribute('data-theme', dark?.matches ? 'dark' : 'light');
theme();
dark?.addEventListener?.('change', theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <PromptProvider>
          <main className="page page-wide">
            <ClassroomApp transport={webTransport} />
          </main>
        </PromptProvider>
      </ConfirmProvider>
    </ToastProvider>
  </StrictMode>,
);
