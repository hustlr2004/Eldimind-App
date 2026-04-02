type SupportedLanguage = 'en' | 'hi' | 'kn';

const DISTRESS_PATTERNS: Record<SupportedLanguage, Array<{ signal: string; patterns: RegExp[] }>> = {
  en: [
    { signal: 'stress', patterns: [/\bstress(ed)?\b/i, /\boverwhelm(ed)?\b/i] },
    { signal: 'anxiety', patterns: [/\banxious\b/i, /\bpanic\b/i, /\bworried\b/i] },
    { signal: 'loneliness', patterns: [/\blonely\b/i, /\balone\b/i, /\bno one\b/i] },
    { signal: 'depression', patterns: [/\bdepressed\b/i, /\bhopeless\b/i, /\bdon'?t want to live\b/i] },
    { signal: 'confusion', patterns: [/\bconfused\b/i, /\bforget\b/i, /\bmemory\b/i] },
  ],
  hi: [
    { signal: 'stress', patterns: [/तनाव/, /परेशान/] },
    { signal: 'anxiety', patterns: [/घबराहट/, /चिंता/] },
    { signal: 'loneliness', patterns: [/अकेला/, /अकेली/, /तन्हा/] },
    { signal: 'depression', patterns: [/उदास/, /जीने का मन नहीं/] },
    { signal: 'confusion', patterns: [/भूल/, /समझ नहीं/] },
  ],
  kn: [
    { signal: 'stress', patterns: [/ಒತ್ತಡ/, /ತೊಂದರೆ/] },
    { signal: 'anxiety', patterns: [/ಆತಂಕ/, /ಭಯ/] },
    { signal: 'loneliness', patterns: [/ಒಂಟಿ/, /ಏಕಾಂಗ/] },
    { signal: 'depression', patterns: [/ದುಃಖ/, /ಬಾಳಲು ಇಷ್ಟ ಇಲ್ಲ/] },
    { signal: 'confusion', patterns: [/ಗೊಂದಲ/, /ಮರೆತು/] },
  ],
};

export function detectDistressSignals(text: string, lang: SupportedLanguage): string[] {
  const source = text || '';
  const entries = DISTRESS_PATTERNS[lang] || DISTRESS_PATTERNS.en;
  const detected = new Set<string>();

  for (const entry of entries) {
    if (entry.patterns.some((pattern) => pattern.test(source))) {
      detected.add(entry.signal);
    }
  }

  return Array.from(detected);
}

export function splitVisionAnalysis(analysis: string) {
  const parts = analysis
    .split(/\n+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    summary: parts[0] || analysis,
    caregiverNote: parts.slice(1).join(' ') || analysis,
  };
}
