import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FeedList } from '../../components/FeedList';
import { MedicineCard } from '../../components/MedicineCard';
import { QuickLinkTile } from '../../components/QuickLinkTile';
import { StatCard } from '../../components/StatCard';
import { fetchJson, postJson } from '../../services/apiClient';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type {
  CaretakerEldersResponse,
  CaretakerOverviewResponse,
  FeedResponse,
  LatestLocationResponse,
  LinkOtpVerifyResponse,
  MedicinesResponse,
  MoodHistoryResponse,
  SosEventsResponse,
} from '../../types';

export function CaretakerDashboardPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const queryClient = useQueryClient();
  const [selectedElderUid, setSelectedElderUid] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');

  const eldersQuery = useQuery({
    queryKey: ['caretaker-elders'],
    queryFn: () => fetchJson<CaretakerEldersResponse>('/api/caretaker/elders'),
    enabled: user?.role === 'caretaker',
  });

  useEffect(() => {
    const firstUid = eldersQuery.data?.elders?.[0]?.uid || null;
    if (selectedElderUid && eldersQuery.data?.elders?.some((elder) => elder.uid === selectedElderUid)) return;
    setSelectedElderUid(firstUid);
  }, [eldersQuery.data?.elders, selectedElderUid]);

  const linkedElderId = useMemo(() => selectedElderUid || eldersQuery.data?.elders?.[0]?.uid || null, [eldersQuery.data?.elders, selectedElderUid]);

  const overviewQuery = useQuery({
    queryKey: ['caretaker-overview', linkedElderId],
    queryFn: () => fetchJson<CaretakerOverviewResponse>(`/api/caretaker/elders/${linkedElderId}/overview`),
    enabled: Boolean(linkedElderId),
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines', linkedElderId],
    queryFn: () => fetchJson<MedicinesResponse>(`/api/medicines/user/${linkedElderId}`),
    enabled: Boolean(linkedElderId),
  });
  const feedQuery = useQuery({
    queryKey: ['feed', linkedElderId],
    queryFn: () => fetchJson<FeedResponse>(`/api/feed/user/${linkedElderId}`),
    enabled: Boolean(linkedElderId),
  });
  const moodsQuery = useQuery({
    queryKey: ['moods', linkedElderId],
    queryFn: () => fetchJson<MoodHistoryResponse>(`/api/moods/user/${linkedElderId}?limit=7`),
    enabled: Boolean(linkedElderId),
  });
  const locationQuery = useQuery({
    queryKey: ['location', linkedElderId],
    queryFn: () => fetchJson<LatestLocationResponse>(`/api/location/user/${linkedElderId}/latest`),
    enabled: Boolean(linkedElderId),
  });
  const sosQuery = useQuery({
    queryKey: ['sos', linkedElderId],
    queryFn: () => fetchJson<SosEventsResponse>(`/api/sos/user/${linkedElderId}`),
    enabled: Boolean(linkedElderId),
  });

  const overview = overviewQuery.data?.overview;
  const medicines = medicinesQuery.data?.medicines?.slice(0, 3) || [];
  const feedItems = feedQuery.data?.feed?.slice(0, 5) || [];
  const moodHistory = moodsQuery.data?.moodLogs?.slice(0, 7) || [];
  const location = locationQuery.data?.location;
  const sosEvents = sosQuery.data?.events?.slice(0, 3) || [];
  const verifyOtpMutation = useMutation({
    mutationFn: () => postJson<LinkOtpVerifyResponse>('/api/link/verify-otp', { code: otpCode }),
    onSuccess: async () => {
      setOtpCode('');
      await queryClient.invalidateQueries({ queryKey: ['caretaker-elders'] });
    },
  });

  return (
    <section className="dashboard-page">
      <div className="hero-card caretaker-hero">
        <p className="eyebrow">{t('caretakerDashboard')}</p>
        <h1>{t('caretakerWelcome')}</h1>
        <p className="hero-text">{linkedElderId ? t('caretakerLinkedMessage') : t('caretakerNoLinkMessage')}</p>
      </div>

      {linkedElderId && overview ? (
        <>
          <div className="overview-panel">
            {eldersQuery.data?.elders && eldersQuery.data.elders.length > 1 ? (
              <label className="settings-form compact-form">
                <span>{t('selectElder')}</span>
                <select value={linkedElderId || ''} onChange={(event) => setSelectedElderUid(event.target.value || null)}>
                  {eldersQuery.data.elders.map((elder) => (
                    <option key={elder.uid} value={elder.uid}>
                      {elder.fullName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <h2>{overview.elder.fullName}</h2>
            <p className="muted">{t('statusChip')}: {overview.statusChip}</p>
          </div>
          <div className="stats-grid">
            <StatCard label={t('todayMood')} value={overview.todayMood?.label || '--'} tone="neutral" />
            <StatCard label={t('heartRate')} value={overview.latestVitals?.heartRate ? `${overview.latestVitals.heartRate} bpm` : '--'} tone="good" />
            <StatCard label={t('oxygen')} value={overview.latestVitals?.spo2 ? `${overview.latestVitals.spo2}%` : '--'} tone="good" />
            <StatCard label={t('recentAlerts')} value={`${overview.recentAlerts.length}`} tone={overview.statusChip === 'Critical' ? 'critical' : 'warn'} />
          </div>
          <div className="dashboard-split">
            <div className="panel">
              <div className="section-head">
                <h2>{t('currentMedicines')}</h2>
                <span className="inline-link">{t('manage')}</span>
              </div>
              <div className="stack-list">
                {medicines.map((medicine) => (
                  <MedicineCard key={medicine._id} medicine={medicine} />
                ))}
                {!medicines.length ? <p className="muted">{t('noMedicines')}</p> : null}
              </div>
            </div>
            <div className="panel">
              <h2>{t('recentActivity')}</h2>
              <FeedList items={feedItems} emptyMessage={t('noActivity')} />
            </div>
          </div>
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
            <p className="muted">{t('caretakerCognitiveDesc')}</p>
            <QuickLinkTile title={t('startSession')} description={t('cognitiveDesc')} to="/cognitive" />
          </div>
          <div className="dashboard-split">
            <div className="panel">
              <div className="section-head">
                <h2>{t('currentLocation')}</h2>
                <a className="inline-link" href="/reports">{t('reports')}</a>
              </div>
              <p className="muted">
                {location ? `${location.latitude}, ${location.longitude}` : t('locationUnavailable')}
              </p>
              <div className="quick-link-row">
                <a className="inline-link" href="/photos">{t('photoJournal')}</a>
                <a className="inline-link" href="/calls">{t('calls')}</a>
              </div>
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
        </>
      ) : (
        <div className="panel">
          <h2>{t('linkElderPrompt')}</h2>
          <p className="muted">{t('linkElderPromptDesc')}</p>
          <div className="settings-form">
            <label>
              <span>{t('otpCode')}</span>
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder={t('otpPlaceholder')}
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            <button
              className="primary-button"
              disabled={verifyOtpMutation.isPending || otpCode.length !== 6}
              onClick={() => verifyOtpMutation.mutate()}
              type="button"
            >
              {verifyOtpMutation.isPending ? t('sending') : t('verifyOtp')}
            </button>
            {verifyOtpMutation.data ? <p className="muted">{t('otpVerified')}</p> : null}
            {verifyOtpMutation.error ? <p className="error-text">{(verifyOtpMutation.error as Error).message}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
