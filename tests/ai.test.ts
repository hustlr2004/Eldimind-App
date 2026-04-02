import request from 'supertest';
import app from '../src/index';

jest.mock('axios', () => ({
  get: jest.fn(async () => ({
    data: Buffer.from('fake-image'),
    headers: { 'content-type': 'image/jpeg' },
  })),
  post: jest.fn(async (_url: string, payload: any) => {
    const promptText = JSON.stringify(payload);
    if (promptText.includes('Provide a short, friendly summary')) {
      return {
        data: {
          responseId: 'gm-vis-1',
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Friendly summary for elder.\nCaregiver note: The elder looks sad and tired.',
                  },
                ],
              },
            },
          ],
        },
      };
    }

    if (promptText.includes('Earlier context from this conversation')) {
      return {
        data: {
          responseId: 'gm-chat-ctx-1',
          candidates: [
            {
              content: {
                parts: [{ text: 'I remember what you shared earlier (mock)' }],
              },
            },
          ],
        },
      };
    }

    return {
      data: {
        responseId: 'gm-chat-1',
        candidates: [
          {
            content: {
              parts: [{ text: 'Hello from Gemini (mock)' }],
            },
          },
        ],
      },
    };
  }),
}));

jest.mock('../src/services/notificationService', () => ({
  sendPushToUid: jest.fn().mockResolvedValue(true),
  notifyCaretakersOfUid: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/models/User', () => {
  const users: any[] = [];
  const User = function (data: any) {
    const obj = { ...data } as any;
    obj.save = jest.fn(async function () { return obj; });
    return obj;
  } as any;
  User.findOne = jest.fn((q: any) => Promise.resolve(users.find((u) => u.uid === q.uid)));
  (User as any).__seed = (user: any) => users.push({ ...user, save: jest.fn(async function () { return this; }) });
  return { User };
});

jest.mock('../src/models/ChatMessage', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => ({
        limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
      })),
    };
  }
  function ChatMessage(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `chat-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (ChatMessage as any).find = jest.fn((query: any) => chain(list.filter((item) => item.userUid === query.userUid)));
  return { ChatMessage };
});

jest.mock('../src/models/PhotoAnalysis', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => ({
        limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
      })),
    };
  }
  function PhotoAnalysis(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `photo-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (PhotoAnalysis as any).find = jest.fn((query: any) => chain(list.filter((item) => item.userUid === query.userUid)));
  return { PhotoAnalysis };
});

jest.mock('../src/models/Alert', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => ({
        limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
      })),
    };
  }
  function Alert(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `alert-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (Alert as any).find = jest.fn((query: any) => chain(list.filter((item) => item.userUid === query.userUid)));
  return { Alert };
});

describe('AI backend routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/ai/chat persists chat and returns distress signals when needed', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-ai-id',
      uid: 'elder-ai',
      fullName: 'AI Elder',
      role: 'elder',
      linkedCaretakers: ['care-ai-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-ai-id',
      uid: 'care-ai',
      fullName: 'AI Care',
      role: 'caretaker',
      linkedElders: ['elder-ai-id'],
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('x-dev-uid', 'elder-ai')
      .send({ message: 'I feel lonely and anxious today' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.response.text).toBeDefined();
    expect(res.body.distressSignals).toEqual(expect.arrayContaining(['loneliness', 'anxiety']));
  });

  it('GET /api/ai/chat/user/:uid returns chat history to a linked caretaker', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    const ChatMessage = jest.requireMock('../src/models/ChatMessage').ChatMessage;

    mockedUsers.User.__seed({
      _id: 'elder-chat-id',
      uid: 'elder-chat',
      fullName: 'Chat Elder',
      role: 'elder',
      linkedCaretakers: ['care-chat-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-chat-id',
      uid: 'care-chat',
      fullName: 'Chat Care',
      role: 'caretaker',
      linkedElders: ['elder-chat-id'],
    });

    await new ChatMessage({
      userUid: 'elder-chat',
      role: 'user',
      text: 'Hello buddy',
      language: 'en',
      distressSignals: [],
    }).save();

    const res = await request(app)
      .get('/api/ai/chat/user/elder-chat')
      .set('x-dev-uid', 'care-chat');

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBeGreaterThan(0);
  });

  it('POST /api/ai/chat uses recent conversation history for context', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');

    mockedUsers.User.__seed({
      _id: 'elder-memory-id',
      uid: 'elder-memory',
      fullName: 'Memory Elder',
      role: 'elder',
      linkedCaretakers: ['care-memory-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-memory-id',
      uid: 'care-memory',
      fullName: 'Memory Care',
      role: 'caretaker',
      linkedElders: ['elder-memory-id'],
    });

    await request(app)
      .post('/api/ai/chat')
      .set('x-dev-uid', 'elder-memory')
      .send({ message: 'My son is visiting tomorrow' });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('x-dev-uid', 'elder-memory')
      .send({ message: 'Can you remind me what I said?' });

    expect(res.status).toBe(200);
    expect(res.body.response.text).toContain('I remember');
  });

  it('POST /api/ai/vision logs photo analysis and returns saved record', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-photo-id',
      uid: 'elder-photo',
      fullName: 'Photo Elder',
      role: 'elder',
      linkedCaretakers: ['care-photo-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-photo-id',
      uid: 'care-photo',
      fullName: 'Photo Care',
      role: 'caretaker',
      linkedElders: ['elder-photo-id'],
    });

    const res = await request(app)
      .post('/api/ai/vision')
      .set('x-dev-uid', 'care-photo')
      .send({ userUid: 'elder-photo', imageUrl: 'https://example.com/img.jpg' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.photoAnalysis.imageUrl).toBe('https://example.com/img.jpg');
    expect(res.body.photoAnalysis.summary).toBeDefined();
  });

  it('GET /api/ai/insights/user/:uid returns caretaker AI insights', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    const ChatMessage = jest.requireMock('../src/models/ChatMessage').ChatMessage;
    const PhotoAnalysis = jest.requireMock('../src/models/PhotoAnalysis').PhotoAnalysis;
    const Alert = jest.requireMock('../src/models/Alert').Alert;

    mockedUsers.User.__seed({
      _id: 'elder-insight-id',
      uid: 'elder-insight',
      fullName: 'Insight Elder',
      role: 'elder',
      linkedCaretakers: ['care-insight-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-insight-id',
      uid: 'care-insight',
      fullName: 'Insight Care',
      role: 'caretaker',
      linkedElders: ['elder-insight-id'],
    });

    await new ChatMessage({
      userUid: 'elder-insight',
      role: 'user',
      text: 'I feel lonely',
      language: 'en',
      distressSignals: ['loneliness'],
    }).save();
    await new PhotoAnalysis({
      userUid: 'elder-insight',
      imageUrl: 'https://example.com/p.jpg',
      summary: 'Friendly summary',
      caregiverNote: 'Looks sad',
      distressSignals: ['depression'],
    }).save();
    await new Alert({
      userUid: 'elder-insight',
      type: 'ai_distress',
      severity: 'warning',
      title: 'AI concern',
      description: 'Concern detected',
      createdAt: '2026-04-02T11:00:00.000Z',
    }).save();

    const res = await request(app)
      .get('/api/ai/insights/user/elder-insight')
      .set('x-dev-uid', 'care-insight');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.insights.topSignals.length).toBeGreaterThan(0);
    expect(res.body.insights.summary).toBeDefined();
  });
});
