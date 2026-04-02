import 'dotenv/config';
import axios from 'axios';

type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  text: string;
};

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_BASE_URL =
  process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models';

if (!GEMINI_KEY) {
  console.warn('GEMINI_API_KEY not set — AI proxy will run in stub mode');
}

function buildGeminiUrl() {
  return `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
}

function extractGeminiText(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const texts = parts
    .map((part: any) => part?.text)
    .filter((value: string | undefined) => typeof value === 'string' && value.trim().length > 0);

  return texts.join('\n').trim() || JSON.stringify(data);
}

function buildLanguageInstruction(lang?: string) {
  if (lang === 'hi') {
    return 'Reply in Hindi with a warm, elder-friendly tone.';
  }

  if (lang === 'kn') {
    return 'Reply in Kannada with a warm, elder-friendly tone.';
  }

  return 'Reply in English with a warm, elder-friendly tone.';
}

export async function callGeminiChat(userId: string | undefined, message: string, extra?: any) {
  const history: ChatHistoryMessage[] = Array.isArray(extra?.history) ? extra.history : [];

  if (!GEMINI_KEY) {
    const memoryPrefix = history.length ? '(stub) I remember what you shared earlier. ' : '(stub) ';
    return {
      id: 'stub',
      text: `${memoryPrefix}Echo: ${message}`,
      meta: { language: extra?.lang || 'en', usedHistory: history.length > 0 },
    };
  }
  const historyParts = history.length
    ? [{ text: 'Earlier context from this conversation:' }].concat(
        history.map((item) => ({
          text: `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.text}`,
        }))
      )
    : [];

  const payload = {
    systemInstruction: {
      parts: [
        {
          text: `You are EldiMind Buddy, an empathetic companion for elderly users. ${buildLanguageInstruction(
            extra?.lang
          )} Keep replies supportive, simple, and concise.`,
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts: [
          ...historyParts,
          { text: message },
          ...(userId ? [{ text: `User ID: ${userId}` }] : []),
        ],
      },
    ],
  };

  const res = await axios.post(buildGeminiUrl(), payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  const data = res.data;
  const text = extractGeminiText(data);
  return { id: data?.responseId || data?.id || null, text, raw: data };
}

export async function callGeminiVision(imageUrl: string) {
  if (!GEMINI_KEY) {
    return { id: 'stub', analysis: 'No image analysis available in stub mode.' };
  }

  const imageResponse = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';
  const imageBase64 = Buffer.from(imageResponse.data).toString('base64');
  return callGeminiVisionFromBase64(imageBase64, mimeType);
}

export async function callGeminiVisionFromBase64(imageBase64: string, mimeType = 'image/jpeg') {
  if (!GEMINI_KEY) {
    return { id: 'stub', analysis: 'No image analysis available in stub mode.' };
  }

  const payload = {
    systemInstruction: {
      parts: [
        {
          text:
            'You are EldiMind Buddy. Analyze this elder photo gently. Mention visible mood, appearance, posture, and whether there are any visible signs that may need caregiver attention. Do not claim medical certainty.',
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
          {
            text: 'Provide a short, friendly summary for the elder and a more observant wellness note for the caretaker log.',
          },
        ],
      },
    ],
  };

  const res = await axios.post(buildGeminiUrl(), payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  return {
    id: res.data?.responseId || res.data?.id || null,
    analysis: extractGeminiText(res.data),
    raw: res.data,
  };
}
