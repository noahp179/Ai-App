import { useEffect, useState } from 'react';
import type { Settings } from '../shared/settings';
import { Companion } from './companion/Companion';
import { ConfirmProvider, Loading, PromptProvider, ToastProvider } from './components/ui';
import { api, errorMessage } from './lib/api';
import { SettingsProvider, applyAppearance } from './lib/settings';
import { Shell } from './shell/Shell';

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isCompanion = location.hash.startsWith('#/companion');

  useEffect(() => {
    api.settings
      .get()
      .then((s) => {
        applyAppearance(s);
        setSettings(s);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    document.body.dataset.window = isCompanion ? 'companion' : 'main';
  }, [isCompanion]);

  if (error) return <div className="page">FlowCompanion could not load its settings: {error}</div>;
  if (!settings) return <Loading label="Starting FlowCompanion…" />;
  return (
    <SettingsProvider initial={settings}>
      <ToastProvider>
        <ConfirmProvider>
          <PromptProvider>{isCompanion ? <Companion /> : <Shell />}</PromptProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
