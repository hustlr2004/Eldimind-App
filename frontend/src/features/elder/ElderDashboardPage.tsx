import { useMutation, useQuery } from '@tanstack/react-query';
import { FeedList } from '../../components/FeedList';
import { MedicineCard } from '../../components/MedicineCard';
import { QuickLinkTile } from '../../components/QuickLinkTile';
import { StatCard } from '../../components/StatCard';
import { fetchJson, postJson } from '../../services/apiClient';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type {
  FeedResponse,
  LatestLocationResponse,
  LinkOtpGenerateResponse,
  MedicinesResponse,
  MoodHistoryResponse,
  SettingsResponse,
  SosEventsResponse,
  VitalsResponse,
} from '../../types';

function greeting(name: string) {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : hour < 21 ? 'Good Evening' : 'Good Night';
  return `${prefix}, ${name}`;
}

export function ElderDashboardPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const otpMutation = useMutation({
    mutationFn: () => postJson<LinkOtpGenerateResponse>('/api/link/generate-otp', {}),
  });

  const vitalsQuery = useQuery({
    queryKey: ['elder-vitals'],
    queryFn: () => fetchJson<VitalsResponse>('/api/vitals/me?limit=1'),
  });

  const settingsQuery = useQuery({
    queryKey: ['elder-settings'],
    queryFn: () => fetchJson<SettingsResponse>('/api/settings/me'),
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines', 'me'],
    queryFn: () => fetchJson<MedicinesResponse>('/api/medicines/me'),
  });
  const feedQuery = useQuery({
    queryKey: ['feed', 'me'],
    queryFn: () => fetchJson<FeedResponse>(`/api/feed/user/${user?.uid}`),
    enabled: Boolean(user?.uid),
  });
  const moodQuery = useQuery({
    queryKey: ['moods', 'me'],
    queryFn: () => fetchJson<MoodHistoryResponse>('/api/moods/me?limit=7'),
  });
  const locationQuery = useQuery({
    queryKey: ['location', 'me'],
    queryFn: () => fetchJson<LatestLocationResponse>('/api/location/me/latest'),
  });
  const sosQuery = useQuery({
    queryKey: ['sos', 'me'],
    queryFn: () => fetchJson<SosEventsResponse>('/api/sos/me'),
  });

  const vital = vitalsQuery.data?.vitals?.[0];
  const connections = settingsQuery.data?.preferences.deviceConnections;
  const medicines = medicinesQuery.data?.medicines?.slice(0, 3) || [];
  const feedItems = feedQuery.data?.feed?.slice(0, 4) || [];
  const latestMood = moodQuery.data?.moodLogs?.[0];
  const moodHistory = moodQuery.data?.moodLogs?.slice(0, 5) || [];
  const location = locationQuery.data?.location;
  const sosEvents = sosQuery.data?.events?.slice(0, 2) || [];

  async function markMedicine(id: string, action: 'taken' | 'skipped') {
    await postJson(`/api/medicines/${id}/taken`, { action });
    await medicinesQuery.refetch();
    await feedQuery.refetch();
  }

  return (
    <section className="dashboard-page">
      <div className="hero-card elder-hero">
        <p className="eyebrow">{t('elderDashboard')}</p>
        <h1>{greeting(user?.fullName || 'Friend')}</h1>
        <p className="hero-text">{t('elderWelcome')}</p>
      </div>

      <div className="panel otp-hero-panel">
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
            <div>
              <p className="eyebrow">{t('otpGenerated')}</p>
              <div className="otp-code">{otpMutation.data.code}</div>
            </div>
            <p className="muted">
              {t('otpExpires')}: {new Date(otpMutation.data.expiresAt).toLocaleTimeString()}
            </p>
          </div>
        ) : (
          <p className="muted">{t('noOtpYet')}</p>
        )}
        {otpMutation.error ? <p className="error-text">{(otpMutation.error as Error).message}</p> : null}
      </div>

      <div className="stats-grid">
        <StatCard label={t('heartRate')} value={vital?.heartRate ? `${vital.heartRate} bpm` : '--'} tone="good" />
        <StatCard label={t('oxygen')} value={vital?.spo2 ? `${vital.spo2}%` : '--'} tone="good" />
        <StatCard label={t('steps')} value={vital?.steps ? `${vital.steps}` : '--'} tone="neutral" />
        <StatCard label={t('todayMood')} value={latestMood ? String(latestMood.mood) : '--'} tone="neutral" />
        <StatCard
          label={t('deviceStatus')}
          value={connections?.googleFit?.status || connections?.manualEntry?.status || 'disconnected'}
          tone="warn"
        />
      </div>

      <div className="tile-grid">
        <QuickLinkTile title={t('medicines')} description={t('medicinesDesc')} to="/medicines" />
        <QuickLinkTile title={t('buddy')} description={t('buddyDesc')} to="/buddy" />
        <QuickLinkTile title={t('cognitiveMode')} description={t('cognitiveDesc')} to="/cognitive" />
        <QuickLinkTile title={t('moodCheckIn')} description={t('moodDesc')} to="/mood" />
        <QuickLinkTile title={t('sos')} description={t('sosDesc')} to="/sos" />
        <QuickLinkTile title={t('photoJournal')} description={t('photoJournalDesc')} to="/photos" />
        <QuickLinkTile title={t('calls')} description={t('callsDesc')} to="/calls" />
        <QuickLinkTile title={t('reports')} description={t('reportsDesc')} to="/reports" />
        <QuickLinkTile title={t('settings')} description={t('settingsDesc')} to="/settings" />
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('todayMedicines')}</h2>
          <div className="stack-list">
            {medicines.map((medicine) => (
              <MedicineCard
                key={medicine._id}
                medicine={medicine}
                onTaken={(id) => void markMedicine(id, 'taken')}
                onSkipped={(id) => void markMedicine(id, 'skipped')}
              />
            ))}
            {!medicines.length ? <p className="muted">{t('noMedicines')}</p> : null}
          </div>
        </div>
        <div className="panel">
          <h2>{t('recentActivity')}</h2>
          <FeedList items={feedItems} emptyMessage={t('noActivity')} />
        </div>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('weeklyMood')}</h2>
          <div className="mood-history">
            {moodHistory.map((entry, index) => (
              <div className={`mood-bar mood-${entry.mood}`} key={`${entry.recordedAt}-${index}`}>
                <span>{new Date(entry.recordedAt).toLocaleDateString([], { weekday: 'short' })}</span>
                <strong>{entry.mood}</strong>
              </div>
            ))}
            {!moodHistory.length ? <p className="muted">{t('noMoodHistory')}</p> : null}
          </div>
        </div>
        <div className="panel">
          <h2>{t('cognitiveMode')}</h2>
          <p className="muted">{t('cognitiveSummary')}</p>
          <QuickLinkTile title={t('startSession')} description={t('cognitiveDesc')} to="/cognitive" />
        </div>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('currentLocation')}</h2>
          <p className="muted">
            {location ? `${location.latitude}, ${location.longitude}` : t('locationUnavailable')}
          </p>
        </div>
        <div className="panel">
          <h2>{t('recentSosEvents')}</h2>
          <div className="stack-list">
            {sosEvents.map((event, index) => (
              <article className="feed-item feed-critical" key={`${event.triggeredAt}-${index}`}>
                <strong>{event.message || event.reason || t('sos')}</strong>
                <p className="muted">{new Date(event.triggeredAt).toLocaleString()}</p>
              </article>
            ))}
            {!sosEvents.length ? <p className="muted">{t('noSosEvents')}</p> : null}
          </div>
        </div>
      </div>

    </section>
  );
}
