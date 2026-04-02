import request from 'supertest';
import app from '../src/index';

jest.mock('../src/services/notificationService', () => ({
  sendPushToUid: jest.fn().mockResolvedValue(true),
  notifyCaretakersOfUid: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/models/User', () => {
  const users: any[] = [];
  const User = function (data: any) {
    return { ...data, save: jest.fn(async function () { return this; }) } as any;
  } as any;
  User.findOne = jest.fn((query: any) => Promise.resolve(users.find((user) => user.uid === query.uid)));
  (User as any).__seed = (user: any) => users.push({ ...user, save: jest.fn(async function () { return this; }) });
  return { User };
});

function createSortedFindMock() {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => Promise.resolve(items)),
    };
  }
  return {
    list,
    chain,
  };
}

const vitalStore = createSortedFindMock();
jest.mock('../src/models/Vital', () => {
  function Vital(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      vitalStore.list.unshift(this);
      return this;
    });
  }
  (Vital as any).find = jest.fn((query: any) =>
    vitalStore.chain(vitalStore.list.filter((item) => item.userUid === query.userUid))
  );
  return { Vital };
});

const moodStore = createSortedFindMock();
jest.mock('../src/models/MoodLog', () => {
  function MoodLog(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      moodStore.list.unshift(this);
      return this;
    });
  }
  (MoodLog as any).find = jest.fn((query: any) =>
    moodStore.chain(moodStore.list.filter((item) => item.userUid === query.userUid))
  );
  return { MoodLog };
});

const medicineLogStore = createSortedFindMock();
jest.mock('../src/models/MedicineLog', () => {
  function MedicineLog(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      medicineLogStore.list.unshift(this);
      return this;
    });
  }
  (MedicineLog as any).find = jest.fn((query: any) =>
    medicineLogStore.chain(medicineLogStore.list.filter((item) => item.userUid === query.userUid))
  );
  return { MedicineLog };
});

const alertStore = createSortedFindMock();
jest.mock('../src/models/Alert', () => {
  function Alert(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      alertStore.list.unshift(this);
      return this;
    });
  }
  (Alert as any).find = jest.fn((query: any) =>
    alertStore.chain(alertStore.list.filter((item) => item.userUid === query.userUid))
  );
  return { Alert };
});

const chatStore = createSortedFindMock();
jest.mock('../src/models/ChatMessage', () => {
  function ChatMessage(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      chatStore.list.unshift(this);
      return this;
    });
  }
  (ChatMessage as any).find = jest.fn((query: any) =>
    chatStore.chain(chatStore.list.filter((item) => item.userUid === query.userUid))
  );
  return { ChatMessage };
});

const photoStore = createSortedFindMock();
jest.mock('../src/models/PhotoAnalysis', () => {
  function PhotoAnalysis(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      photoStore.list.unshift(this);
      return this;
    });
  }
  (PhotoAnalysis as any).find = jest.fn((query: any) =>
    photoStore.chain(photoStore.list.filter((item) => item.userUid === query.userUid))
  );
  return { PhotoAnalysis };
});

describe('Weekly reports API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns weekly report data for a linked caretaker', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    const Vital = jest.requireMock('../src/models/Vital').Vital;
    const MoodLog = jest.requireMock('../src/models/MoodLog').MoodLog;
    const MedicineLog = jest.requireMock('../src/models/MedicineLog').MedicineLog;
    const Alert = jest.requireMock('../src/models/Alert').Alert;
    const ChatMessage = jest.requireMock('../src/models/ChatMessage').ChatMessage;
    const PhotoAnalysis = jest.requireMock('../src/models/PhotoAnalysis').PhotoAnalysis;

    mockedUsers.User.__seed({
      _id: 'elder-report-id',
      uid: 'elder-report',
      fullName: 'Report Elder',
      role: 'elder',
      linkedCaretakers: ['care-report-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-report-id',
      uid: 'care-report',
      fullName: 'Report Care',
      role: 'caretaker',
      linkedElders: ['elder-report-id'],
    });

    await new Vital({
      userUid: 'elder-report',
      heartRate: 82,
      sleepHours: 7,
      steps: 3200,
      recordedAt: new Date(),
    }).save();
    await new MoodLog({
      userUid: 'elder-report',
      mood: 4,
      recordedAt: new Date(),
    }).save();
    await new MedicineLog({
      userUid: 'elder-report',
      medicineId: 'med-1',
      action: 'taken',
      timestamp: new Date(),
    }).save();
    await new Alert({
      userUid: 'elder-report',
      type: 'ai_distress',
      severity: 'warning',
      title: 'AI concern',
      description: 'Concern',
      createdAt: new Date(),
    }).save();
    await new ChatMessage({
      userUid: 'elder-report',
      role: 'user',
      text: 'I feel lonely',
      language: 'en',
      distressSignals: ['loneliness'],
      createdAt: new Date(),
    }).save();
    await new PhotoAnalysis({
      userUid: 'elder-report',
      imageUrl: 'https://example.com/report.jpg',
      summary: 'Summary',
      caregiverNote: 'Note',
      distressSignals: ['depression'],
      createdAt: new Date(),
    }).save();

    const res = await request(app)
      .get('/api/reports/weekly/user/elder-report')
      .set('x-dev-uid', 'care-report');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.report.user.fullName).toBe('Report Elder');
    expect(res.body.report.charts.heartRateTrend.length).toBe(7);
    expect(res.body.report.medicationAdherence.taken).toBe(1);
    expect(res.body.report.mentalWellnessScore).toBeDefined();
  });
});
