import { useEffect, useState } from 'react';
import { usePreferences } from '../app/preferences/PreferencesProvider';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function InstallPrompt() {
  const { t } = usePreferences();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div aria-live="polite" className="install-pill">
      <span>{t('installApp')}</span>
      <button className="ghost-button" onClick={() => void handleInstall()} type="button">
        {t('install')}
      </button>
      <button aria-label="Dismiss install prompt" className="ghost-button" onClick={() => setVisible(false)} type="button">
        ×
      </button>
    </div>
  );
}
