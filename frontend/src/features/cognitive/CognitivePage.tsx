import { FormEvent, useEffect, useState } from 'react';
import { usePreferences } from '../../app/preferences/PreferencesProvider';

type CognitiveStats = {
  sessionsCompleted: number;
  bestMemoryMatches: number;
  bestQuizScore: number;
  lastPlayedAt: string | null;
};

type QuizChoice = 'A' | 'B' | 'C';

type QuizQuestion = {
  prompt: string;
  choices: Array<{ id: QuizChoice; text: string }>;
  answer: QuizChoice;
};

const STORAGE_KEY = 'eldimind_cognitive_stats';
const memorySymbols = ['☀', '☀', '✿', '✿', '♥', '♥', '♫', '♫'];
const wordAssociationPrompts = ['family', 'garden', 'comfort', 'friend', 'tea', 'music'];

const quizQuestions: QuizQuestion[] = [
  {
    prompt: 'Which meal usually begins the day?',
    choices: [
      { id: 'A', text: 'Breakfast' },
      { id: 'B', text: 'Dinner' },
      { id: 'C', text: 'Midnight snack' },
    ],
    answer: 'A',
  },
  {
    prompt: 'How many days are there in one week?',
    choices: [
      { id: 'A', text: 'Five' },
      { id: 'B', text: 'Seven' },
      { id: 'C', text: 'Nine' },
    ],
    answer: 'B',
  },
  {
    prompt: 'Which one is a fruit?',
    choices: [
      { id: 'A', text: 'Apple' },
      { id: 'B', text: 'Chair' },
      { id: 'C', text: 'Clock' },
    ],
    answer: 'A',
  },
];

function shuffleCards() {
  return [...memorySymbols]
    .sort(() => Math.random() - 0.5)
    .map((symbol, index) => ({
      id: `${symbol}-${index}`,
      symbol,
      matched: false,
      revealed: false,
    }));
}

function buildSequence() {
  return Array.from({ length: 5 }, () => String(Math.floor(Math.random() * 9) + 1)).join('');
}

function loadStats(): CognitiveStats {
  if (typeof window === 'undefined') {
    return { sessionsCompleted: 0, bestMemoryMatches: 0, bestQuizScore: 0, lastPlayedAt: null };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { sessionsCompleted: 0, bestMemoryMatches: 0, bestQuizScore: 0, lastPlayedAt: null };
    }
    return JSON.parse(raw) as CognitiveStats;
  } catch {
    return { sessionsCompleted: 0, bestMemoryMatches: 0, bestQuizScore: 0, lastPlayedAt: null };
  }
}

export function CognitivePage() {
  const { t } = usePreferences();
  const [stats, setStats] = useState<CognitiveStats>(() => loadStats());
  const [cards, setCards] = useState(() => shuffleCards());
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [memoryMatches, setMemoryMatches] = useState(0);
  const [memoryStatus, setMemoryStatus] = useState('');

  const [associationPrompt, setAssociationPrompt] = useState(wordAssociationPrompts[0]);
  const [associationAnswer, setAssociationAnswer] = useState('');
  const [associationStatus, setAssociationStatus] = useState('');

  const [quizAnswers, setQuizAnswers] = useState<Record<number, QuizChoice | undefined>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const [sequence, setSequence] = useState(buildSequence());
  const [showSequence, setShowSequence] = useState(true);
  const [sequenceAnswer, setSequenceAnswer] = useState('');
  const [sequenceStatus, setSequenceStatus] = useState('');

  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [breathingCount, setBreathingCount] = useState(4);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    if (selectedCardIds.length !== 2) return;

    const timeout = window.setTimeout(() => {
      const selectedCards = cards.filter((card) => selectedCardIds.includes(card.id));
      const isMatch = selectedCards[0]?.symbol === selectedCards[1]?.symbol;

      setCards((current) =>
        current.map((card) => {
          if (!selectedCardIds.includes(card.id)) return card;
          return {
            ...card,
            matched: isMatch ? true : card.matched,
            revealed: isMatch ? true : false,
          };
        })
      );
      setSelectedCardIds([]);

      if (isMatch) {
        const nextMatches = memoryMatches + 1;
        setMemoryMatches(nextMatches);
        setMemoryStatus(`Nice work. You found match ${nextMatches}.`);
        if (nextMatches >= memorySymbols.length / 2) {
          completeSession({ bestMemoryMatches: nextMatches });
          setMemoryStatus('Wonderful. You completed the memory round.');
        }
      } else {
        setMemoryStatus('Not that pair. Try another two cards.');
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [cards, memoryMatches, selectedCardIds]);

  useEffect(() => {
    if (!showSequence) return;
    const timeout = window.setTimeout(() => setShowSequence(false), 2600);
    return () => window.clearTimeout(timeout);
  }, [sequence, showSequence]);

  useEffect(() => {
    if (!breathingActive) return;
    const durations = { inhale: 4, hold: 7, exhale: 8 } as const;

    const interval = window.setInterval(() => {
      setBreathingCount((current) => {
        if (current > 1) return current - 1;

        setBreathingPhase((phase) => {
          if (phase === 'inhale') {
            setBreathingCount(durations.hold);
            return 'hold';
          }
          if (phase === 'hold') {
            setBreathingCount(durations.exhale);
            return 'exhale';
          }
          setBreathingCount(durations.inhale);
          completeSession();
          return 'inhale';
        });

        return 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [breathingActive]);

  function completeSession(overrides?: Partial<CognitiveStats>) {
    setStats((current) => ({
      sessionsCompleted: current.sessionsCompleted + 1,
      bestMemoryMatches: Math.max(current.bestMemoryMatches, overrides?.bestMemoryMatches ?? current.bestMemoryMatches),
      bestQuizScore: Math.max(current.bestQuizScore, overrides?.bestQuizScore ?? current.bestQuizScore),
      lastPlayedAt: new Date().toISOString(),
    }));
  }

  function flipCard(cardId: string) {
    const selected = cards.find((card) => card.id === cardId);
    if (!selected || selected.matched || selected.revealed || selectedCardIds.length >= 2) return;

    setCards((current) =>
      current.map((card) => (card.id === cardId ? { ...card, revealed: true } : card))
    );
    setSelectedCardIds((current) => [...current, cardId]);
  }

  function resetMemory() {
    setCards(shuffleCards());
    setSelectedCardIds([]);
    setMemoryMatches(0);
    setMemoryStatus('');
  }

  function submitAssociation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (associationAnswer.trim().length < 2) {
      setAssociationStatus('Add one related word or phrase to continue.');
      return;
    }

    completeSession();
    setAssociationStatus(`Lovely. "${associationAnswer.trim()}" works as a gentle association for "${associationPrompt}".`);
    setAssociationAnswer('');
    setAssociationPrompt(wordAssociationPrompts[Math.floor(Math.random() * wordAssociationPrompts.length)]);
  }

  function submitQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextScore = quizQuestions.reduce((total, question, index) => {
      return total + (quizAnswers[index] === question.answer ? 1 : 0);
    }, 0);
    setQuizScore(nextScore);
    completeSession({ bestQuizScore: nextScore });
  }

  function resetSequence() {
    setSequence(buildSequence());
    setSequenceAnswer('');
    setSequenceStatus('');
    setShowSequence(true);
  }

  function submitSequence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sequenceAnswer.trim() === sequence) {
      completeSession();
      setSequenceStatus('Excellent recall. You repeated the sequence correctly.');
    } else {
      setSequenceStatus(`Close. The sequence was ${sequence}. Try another round.`);
    }
  }

  return (
    <section className="dashboard-page">
      <div className="hero-card elder-hero">
        <p className="eyebrow">{t('cognitiveMode')}</p>
        <h1>{t('cognitiveTitle')}</h1>
        <p className="hero-text">{t('cognitiveSubtitle')}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">{t('cognitiveSessions')}</p>
          <div className="stat-value">{stats.sessionsCompleted}</div>
        </div>
        <div className="stat-card">
          <p className="stat-label">{t('memoryCards')}</p>
          <div className="stat-value">{stats.bestMemoryMatches}</div>
        </div>
        <div className="stat-card">
          <p className="stat-label">{t('dailyQuiz')}</p>
          <div className="stat-value">{stats.bestQuizScore}</div>
        </div>
        <div className="stat-card">
          <p className="stat-label">{t('completedToday')}</p>
          <div className="stat-value">{stats.lastPlayedAt ? new Date(stats.lastPlayedAt).toLocaleDateString() : '--'}</div>
        </div>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <div className="section-head">
            <h2>{t('memoryCards')}</h2>
            <button className="ghost-button" onClick={resetMemory} type="button">
              {t('nextRound')}
            </button>
          </div>
          <p className="muted">{t('cognitiveSummary')}</p>
          <div className="memory-grid" role="list">
            {cards.map((card) => (
              <button
                aria-label={card.revealed || card.matched ? `Card ${card.symbol}` : 'Hidden memory card'}
                className={`memory-card${card.revealed || card.matched ? ' memory-card-revealed' : ''}`}
                key={card.id}
                onClick={() => flipCard(card.id)}
                type="button"
              >
                <span>{card.revealed || card.matched ? card.symbol : '?'}</span>
              </button>
            ))}
          </div>
          {memoryStatus ? <p className="muted">{memoryStatus}</p> : null}
        </div>

        <div className="panel">
          <h2>{t('wordAssociation')}</h2>
          <p className="muted">
            {t('promptWord')}: <strong>{associationPrompt}</strong>
          </p>
          <form className="settings-form" onSubmit={submitAssociation}>
            <label>
              <span>{t('yourAnswer')}</span>
              <input value={associationAnswer} onChange={(event) => setAssociationAnswer(event.target.value)} />
            </label>
            <button className="primary-button" type="submit">
              {t('submitWord')}
            </button>
          </form>
          {associationStatus ? <p className="muted">{associationStatus}</p> : null}
        </div>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('dailyQuiz')}</h2>
          <form className="settings-form" onSubmit={submitQuiz}>
            {quizQuestions.map((question, index) => (
              <fieldset className="quiz-card" key={question.prompt}>
                <legend>{question.prompt}</legend>
                {question.choices.map((choice) => (
                  <label className="checkbox-row" key={choice.id}>
                    <input
                      checked={quizAnswers[index] === choice.id}
                      name={`quiz-${index}`}
                      onChange={() => setQuizAnswers((current) => ({ ...current, [index]: choice.id }))}
                      type="radio"
                    />
                    <span>{choice.text}</span>
                  </label>
                ))}
              </fieldset>
            ))}
            <button className="primary-button" type="submit">
              {t('checkAnswer')}
            </button>
          </form>
          {quizScore !== null ? <p className="muted">{t('score')}: {quizScore}/{quizQuestions.length}</p> : null}
        </div>

        <div className="panel">
          <div className="section-head">
            <h2>{t('numberSequence')}</h2>
            <button className="ghost-button" onClick={resetSequence} type="button">
              {t('nextRound')}
            </button>
          </div>
          <p className="muted">{t('sequencePrompt')}</p>
          <div className="sequence-display" aria-live="polite">
            {showSequence ? sequence : '• • • • •'}
          </div>
          <form className="settings-form" onSubmit={submitSequence}>
            <label>
              <span>{t('repeatSequence')}</span>
              <input inputMode="numeric" value={sequenceAnswer} onChange={(event) => setSequenceAnswer(event.target.value)} />
            </label>
            <button className="primary-button" type="submit">
              {t('checkAnswer')}
            </button>
          </form>
          {sequenceStatus ? <p className="muted">{sequenceStatus}</p> : null}
        </div>
      </div>

      <div className="panel">
        <div className="section-head">
          <h2>{t('breathingExercise')}</h2>
          <button className="ghost-button" onClick={() => setBreathingActive((current) => !current)} type="button">
            {breathingActive ? 'Pause' : t('startSession')}
          </button>
        </div>
        <p className="muted">{t('breathingPrompt')}</p>
        <div className={`breathing-orb breathing-${breathingPhase}${breathingActive ? ' breathing-active' : ''}`}>
          <strong>{t(breathingPhase)}</strong>
          <span>{breathingCount}</span>
        </div>
      </div>
    </section>
  );
}
