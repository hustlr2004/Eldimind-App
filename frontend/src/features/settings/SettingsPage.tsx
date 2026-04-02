import { FormEvent, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchJson, patchJson, postJson } from '../../services/apiClient';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type { LinkOtpGenerateResponse, SettingsResponse } from '../../types';

export function SettingsPage() {
  const { user } = useAuth();
  const { language, setLanguage, theme, setTheme, fontScale, setFontScale, t } = usePreferences();
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchJson<SettingsResponse>('/api/settings/me'),
  });
  const otpMutation = useMutation({
    mutationFn: () => postJson<LinkOtpGenerateResponse>('/api/link/generate-otp', {}),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    setMessage(null);
    try {
      await patchJson('/api/settings/me', {
        language,
        theme,
        fontSize: fontScale,
        notifications: {
          enabled: formData.get('notificationsEnabled') === 'on',
          sound: formData.get('sound') === 'on',
          vibration: formData.get('vibration') === 'on',
        },
      });
      setMessage(t('settingsSaved'));
    } catch (err: any) {
      setMessage(err.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  const notifications = settingsQuery.data?.preferences.notifications;

  return (
    <section className="dashboard-page">
      <div className="panel">
        <h1>{t('settings')}</h1>
        {user?.role === 'elder' ? (
          <div className="otp-settings-block">
            <div className="section-head">
              <div>
                <h2>{t('linkCaretaker')}</h2>
                <p className="muted">{t('linkCaretakerDesc')}</p>
              </div>
              <button className="primary-button" disabled={otpMutation.isPending} onClick={() => otpMutation.mutate()} type="button">
                {otpMutation.isPending ? t('sending') : t('generateOtp')}
              </button>
            </div>
            {otpMutation.data ? (
              <div className="otp-panel">
                <div className="otp-code">{otpMutation.data.code}</div>
                <p className="muted">
                  {t('otpExpires')}: {new Date(otpMutation.data.expiresAt).toLocaleTimeString()}
                </p>
              </div>
            ) : null}
            {otpMutation.error ? <p className="error-text">{(otpMutation.error as Error).message}</p> : null}
          </div>
        ) : null}
        <form className="settings-form" onSubmit={saveSettings}>
          <label>
            <span>{t('language')}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'hi' | 'kn')}>
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
              <option value="kn">ಕನ್ನಡ</option>
            </select>
          </label>

          <label>
            <span>{t('theme')}</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value as 'light' | 'dark' | 'high_contrast')}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="high_contrast">High Contrast</option>
            </select>
          </label>

          <label>
            <span>{t('fontSize')}</span>
            <select value={fontScale} onChange={(event) => setFontScale(event.target.value as 'normal' | 'large' | 'extra_large')}>
              <option value="normal">Normal</option>
              <option value="large">Large</option>
              <option value="extra_large">Extra Large</option>
            </select>
          </label>

          <label className="checkbox-row">
            <input name="notificationsEnabled" type="checkbox" defaultChecked={notifications?.enabled ?? true} />
            <span>{t('notificationsEnabled')}</span>
          </label>
          <label className="checkbox-row">
            <input name="sound" type="checkbox" defaultChecked={notifications?.sound ?? true} />
            <span>{t('soundAlerts')}</span>
          </label>
          <label className="checkbox-row">
            <input name="vibration" type="checkbox" defaultChecked={notifications?.vibration ?? true} />
            <span>{t('vibrationAlerts')}</span>
          </label>

          {message ? <p className="muted">{message}</p> : null}
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? t('saving') : t('saveSettings')}
          </button>
        </form>
      </div>
    </section>
  );
}
