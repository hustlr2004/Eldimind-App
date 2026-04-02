import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson, postJson } from '../../services/apiClient';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type { LatestLocationResponse, SosEventsResponse } from '../../types';

export function SosPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('Need urgent help');

  const locationQuery = useQuery({
    queryKey: ['location', 'me'],
    queryFn: () => fetchJson<LatestLocationResponse>('/api/location/me/latest'),
  });

  const sosHistoryQuery = useQuery({
    queryKey: ['sos', 'me'],
    queryFn: () => fetchJson<SosEventsResponse>('/api/sos/me'),
  });

  const sosMutation = useMutation({
    mutationFn: async () => {
      const location = locationQuery.data?.location;
      return postJson('/api/sos', {
        reason,
        message: reason,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sos', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['feed', 'me'] });
    },
  });

  const events = sosHistoryQuery.data?.events || [];

  return (
    <section className="dashboard-page">
      <div className="hero-card sos-hero">
        <p className="eyebrow">{t('sos')}</p>
        <h1>{t('sosTitle')}</h1>
        <p className="hero-text">{t('sosSubtitle')}</p>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('emergencyAction')}</h2>
          <label className="settings-form">
            <span>{t('emergencyReason')}</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <button className="sos-button" disabled={sosMutation.isPending} onClick={() => sosMutation.mutate()} type="button">
            {sosMutation.isPending ? t('sendingAlert') : t('triggerSos')}
          </button>
          <p className="muted">{t('currentLocation')}: {locationQuery.data?.location ? `${locationQuery.data.location.latitude}, ${locationQuery.data.location.longitude}` : t('locationUnavailable')}</p>
        </div>

        <div className="panel">
          <h2>{t('recentSosEvents')}</h2>
          <div className="stack-list">
            {events.map((event, index) => (
              <article className="feed-item feed-critical" key={`${event.triggeredAt}-${index}`}>
                <strong>{event.message || event.reason || t('sos')}</strong>
                <p className="muted">{new Date(event.triggeredAt).toLocaleString()}</p>
              </article>
            ))}
            {!events.length ? <p className="muted">{t('noSosEvents')}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
