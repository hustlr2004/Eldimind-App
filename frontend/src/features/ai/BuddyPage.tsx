import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatThread } from '../../components/ChatThread';
import { fetchJson, postJson } from '../../services/apiClient';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type { BuddyChatResponse, ChatHistoryResponse } from '../../types';

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal?: boolean;
    0: {
      transcript: string;
    };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

export function BuddyPage() {
  const { t } = usePreferences();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript || '';
      }
      setDraft(transcript.trim());
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setSpeechError(event.error === 'not-allowed' ? t('micPermissionDenied') : t('micUnavailable'));
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [t]);

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
    setDraftError(null);
    sendMutation.mutate(trimmed);
  }

  function handleMicToggle() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setSpeechError(t('micUnsupported'));
      return;
    }

    setSpeechError(null);
    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }

    recognition.lang = navigator.language || 'en-US';
    recognition.start();
    setIsListening(true);
  }

  const messages = [...(chatQuery.data?.messages || [])].reverse();
  const visibleMessages = sendMutation.isPending
    ? [
        ...messages,
        {
          role: 'user' as const,
          text: draft.trim(),
          createdAt: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          text: 'EldiMind Buddy is thinking...',
          createdAt: new Date().toISOString(),
        },
      ]
    : messages;

  useEffect(() => {
    if (sendMutation.error) {
      setDraftError((sendMutation.error as Error).message);
    }
  }, [sendMutation.error]);

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
          {chatQuery.error ? <p className="error-text">{(chatQuery.error as Error).message}</p> : null}
          <ChatThread messages={visibleMessages} emptyMessage={t('buddyEmpty')} />
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
            <div className="buddy-actions">
              <button className="ghost-button mic-button" onClick={handleMicToggle} type="button">
                {isListening ? t('stopListening') : t('startListening')}
              </button>
              <p className="muted mic-status">
                {isListening ? t('listeningNow') : t('micHint')}
              </p>
            </div>
            {speechError ? <p className="error-text">{speechError}</p> : null}
            {draftError ? <p className="error-text">{draftError}</p> : null}
            <button className="primary-button" disabled={sendMutation.isPending} type="submit">
              {sendMutation.isPending ? t('sending') : t('send')}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
