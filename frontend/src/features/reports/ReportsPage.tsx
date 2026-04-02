import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson, postJson } from '../../services/apiClient';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import { useMutation } from '@tanstack/react-query';
import type { CaretakerEldersResponse, ReportExportResponse, WeeklyReportResponse } from '../../types';

export function ReportsPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const [selectedElderUid, setSelectedElderUid] = useState<string | null>(null);

  const eldersQuery = useQuery({
    queryKey: ['caretaker-elders'],
    queryFn: () => fetchJson<CaretakerEldersResponse>('/api/caretaker/elders'),
    enabled: user?.role === 'caretaker',
  });

  useEffect(() => {
    const firstUid = eldersQuery.data?.elders?.[0]?.uid || null;
    if (selectedElderUid && eldersQuery.data?.elders?.some((elder) => elder.uid === selectedElderUid)) return;
    if (user?.role === 'elder') return;
    setSelectedElderUid(firstUid);
  }, [eldersQuery.data?.elders, selectedElderUid, user?.role]);

  const elderUid = useMemo(() => {
    if (user?.role === 'elder') return user.uid;
    return selectedElderUid || eldersQuery.data?.elders?.[0]?.uid || null;
  }, [eldersQuery.data?.elders, selectedElderUid, user]);

  const reportQuery = useQuery({
    queryKey: ['weekly-report', elderUid],
    queryFn: () => fetchJson<WeeklyReportResponse>(`/api/reports/weekly/user/${elderUid}`),
    enabled: Boolean(elderUid),
  });
  const exportMutation = useMutation({
    mutationFn: () => postJson<ReportExportResponse>(`/api/reports/weekly/user/${elderUid}/export`, {}),
  });

  const report = reportQuery.data?.report;

  return (
    <section className="dashboard-page">
      <div className="hero-card caretaker-hero">
        <p className="eyebrow">{t('reports')}</p>
        <h1>{t('weeklyReportTitle')}</h1>
        <p className="hero-text">{t('weeklyReportSubtitle')}</p>
      </div>

      {report ? (
        <div className="dashboard-split">
          <div className="panel">
            <h2>{t('reportHighlights')}</h2>
            {user?.role === 'caretaker' && eldersQuery.data?.elders && eldersQuery.data.elders.length > 1 ? (
              <label className="settings-form compact-form">
                <span>{t('selectElder')}</span>
                <select value={elderUid || ''} onChange={(event) => setSelectedElderUid(event.target.value || null)}>
                  {eldersQuery.data.elders.map((elder) => (
                    <option key={elder.uid} value={elder.uid}>
                      {elder.fullName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button className="primary-button report-export" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()} type="button">
              {exportMutation.isPending ? t('exporting') : t('exportReport')}
            </button>
            {exportMutation.data?.downloadUrl ? (
              <a className="inline-link" href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}${exportMutation.data.downloadUrl}`} target="_blank" rel="noreferrer">
                {t('downloadLatestReport')}
              </a>
            ) : null}
            <div className="stack-list">
              <div className="report-card">
                <strong>{t('mentalWellnessScore')}</strong>
                <span>{report.mentalWellnessScore}</span>
              </div>
              <div className="report-card">
                <strong>{t('medicationAdherenceLabel')}</strong>
                <span>{report.medicationAdherence.adherencePercent ?? '--'}%</span>
              </div>
              <div className="report-card">
                <strong>{t('alertsThisWeek')}</strong>
                <span>{report.totals.alerts}</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>{t('trendPreview')}</h2>
            <div className="mini-chart-list">
              {report.charts.heartRateTrend.map((entry, index) => (
                <div className="mini-chart-row" key={`${entry.date}-${index}`}>
                  <span>{entry.date.slice(5)}</span>
                  <div className="mini-bar-track">
                    <div className="mini-bar" style={{ width: `${Math.min(entry.heartRate ?? 0, 140) / 1.4}%` }} />
                  </div>
                  <strong>{entry.heartRate ?? '--'}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel">
          <p className="muted">{t('reportLoading')}</p>
        </div>
      )}
    </section>
  );
}
