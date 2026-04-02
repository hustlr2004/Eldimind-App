import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatThread } from '../../components/ChatThread';
import { fetchJson, postJson } from '../../services/apiClient';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type { BuddyChatResponse, ChatHistoryResponse } from '../../types';

export function BuddyPage() {
  const { t } = usePreferences();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const chatQuery = useQuery({
    queryKey: ['buddy-chat'],
    queryFn: () => fetchJson<ChatHistoryResponse>('/api/ai/chat/me?limit=20'),
  });

  const sendMutation = useMutation({
    mutationFn: (message: string) => postJson<BuddyChatResponse>('/api/ai/chat', { message }),
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['buddy-chat'] });
      await queryClient.invalidateQueries({ queryKey: ['feed', 'me'] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  }

  const messages = [...(chatQuery.data?.messages || [])].reverse();

  return (
    <section className="dashboard-page">
      <div className="hero-card elder-hero">
        <p className="eyebrow">{t('buddy')}</p>
        <h1>{t('buddyTitle')}</h1>
        <p className="hero-text">{t('buddyIntro')}</p>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('conversation')}</h2>
          <ChatThread messages={messages} emptyMessage={t('buddyEmpty')} />
        </div>
        <div className="panel">
          <h2>{t('sendMessage')}</h2>
          <form className="settings-form" onSubmit={handleSubmit}>
            <label>
              <span>{t('message')}</span>
              <textarea
                className="message-box"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('buddyPromptPlaceholder')}
              />
            </label>
            <button className="primary-button" disabled={sendMutation.isPending} type="submit">
              {sendMutation.isPending ? t('sending') : t('send')}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
