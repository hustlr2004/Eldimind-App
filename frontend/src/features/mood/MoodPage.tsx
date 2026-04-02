import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoodPicker } from '../../components/MoodPicker';
import { fetchJson, postJson } from '../../services/apiClient';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type { MoodHistoryResponse } from '../../types';

export function MoodPage() {
  const { t } = usePreferences();
  const queryClient = useQueryClient();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

  const moodQuery = useQuery({
    queryKey: ['moods', 'me'],
    queryFn: () => fetchJson<MoodHistoryResponse>('/api/moods/me?limit=7'),
  });

  const saveMoodMutation = useMutation({
    mutationFn: (mood: number) => postJson('/api/moods', { mood }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['moods', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['feed', 'me'] });
    },
  });

  const moodLogs = moodQuery.data?.moodLogs || [];

  return (
    <section className="dashboard-page">
      <div className="hero-card elder-hero">
        <p className="eyebrow">{t('todayMood')}</p>
        <h1>{t('moodTitle')}</h1>
        <p className="hero-text">{t('moodSubtitle')}</p>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('howAreYouFeeling')}</h2>
          <MoodPicker selected={selectedMood} onSelect={setSelectedMood} />
          <button
            className="primary-button mood-save"
            disabled={!selectedMood || saveMoodMutation.isPending}
            onClick={() => selectedMood && saveMoodMutation.mutate(selectedMood)}
            type="button"
          >
            {saveMoodMutation.isPending ? t('saving') : t('saveMood')}
          </button>
        </div>
        <div className="panel">
          <h2>{t('weeklyMood')}</h2>
          <div className="mood-history">
            {moodLogs.map((entry, index) => (
              <div className={`mood-bar mood-${entry.mood}`} key={`${entry.recordedAt}-${index}`}>
                <span>{new Date(entry.recordedAt).toLocaleDateString([], { weekday: 'short' })}</span>
                <strong>{entry.mood}</strong>
              </div>
            ))}
            {!moodLogs.length ? <p className="muted">{t('noMoodHistory')}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
