import request from 'supertest';
import app from '../src/index';

jest.mock('../src/models/User', () => {
  const users: any[] = [];
  const User = function (data: any) {
    return { emergencyContacts: [], preferences: {}, ...data, save: jest.fn(async function () { return this; }) } as any;
  } as any;
  User.findOne = jest.fn((query: any) => Promise.resolve(users.find((user) => user.uid === query.uid)));
  (User as any).__seed = (user: any) =>
    users.push({ emergencyContacts: [], preferences: {}, ...user, save: jest.fn(async function () { return this; }) });
  return { User };
});

function chainSortLimit(items: any[]) {
  return {
    sort: jest.fn(() => ({
      limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
    })),
  };
}

function chainSort(items: any[]) {
  return {
    sort: jest.fn(() => Promise.resolve(items)),
  };
}

jest.mock('../src/models/Report', () => {
  const list: any[] = [];
  const Report = {
    create: jest.fn(async (data: any) => {
      const record = { _id: `report-${list.length + 1}`, ...data, createdAt: new Date() };
      list.unshift(record);
      return record;
    }),
    find: jest.fn((query: any) => chainSortLimit(list.filter((item) => item.userUid === query.userUid))),
  } as any;
  return { Report };
});

jest.mock('../src/models/CallLog', () => {
  const list: any[] = [];
  const CallLog = {
    create: jest.fn(async (data: any) => {
      const record = { _id: `call-${list.length + 1}`, ...data, createdAt: new Date() };
      list.unshift(record);
      return record;
    }),
    find: jest.fn((query: any) =>
      chainSortLimit(
        list.filter((item) => {
          const elderMatch = query.$or?.some((cond: any) => cond.elderUid === item.elderUid);
          const caretakerMatch = query.$or?.some((cond: any) => cond.caretakerUid === item.caretakerUid);
          return elderMatch || caretakerMatch;
        })
      )
    ),
  } as any;
  return { CallLog };
});

const vitalList: any[] = [];
jest.mock('../src/models/Vital', () => ({
  Vital: {
    find: jest.fn((query: any) => chainSort(vitalList.filter((item) => item.userUid === query.userUid))),
  },
}));

const moodList: any[] = [];
jest.mock('../src/models/MoodLog', () => ({
  MoodLog: {
    find: jest.fn((query: any) => chainSort(moodList.filter((item) => item.userUid === query.userUid))),
  },
}));

const medLogList: any[] = [];
jest.mock('../src/models/MedicineLog', () => ({
  MedicineLog: {
    find: jest.fn((query: any) => chainSort(medLogList.filter((item) => item.userUid === query.userUid))),
  },
}));

const alertList: any[] = [];
jest.mock('../src/models/Alert', () => ({
  Alert: {
    find: jest.fn((query: any) => chainSort(alertList.filter((item) => item.userUid === query.userUid))),
  },
}));

const chatList: any[] = [];
jest.mock('../src/models/ChatMessage', () => ({
  ChatMessage: {
    find: jest.fn((query: any) => chainSort(chatList.filter((item) => item.userUid === query.userUid))),
  },
}));

const photoAnalysisList: any[] = [];
jest.mock('../src/models/PhotoAnalysis', () => ({
  PhotoAnalysis: {
    find: jest.fn((query: any) => chainSort(photoAnalysisList.filter((item) => item.userUid === query.userUid))),
  },
}));

describe('Calls and report export APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vitalList.length = 0;
    moodList.length = 0;
    medLogList.length = 0;
    alertList.length = 0;
    chatList.length = 0;
    photoAnalysisList.length = 0;
  });

  it('exports a weekly report and saves a report record', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-export-id',
      uid: 'elder-export',
      fullName: 'Export Elder',
      role: 'elder',
      linkedCaretakers: ['care-export-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-export-id',
      uid: 'care-export',
      fullName: 'Export Care',
      role: 'caretaker',
      linkedElders: ['elder-export-id'],
    });

    vitalList.push({ userUid: 'elder-export', heartRate: 80, recordedAt: new Date() });
    moodList.push({ userUid: 'elder-export', mood: 4, recordedAt: new Date() });
    medLogList.push({ userUid: 'elder-export', action: 'taken', timestamp: new Date() });
    alertList.push({ userUid: 'elder-export', type: 'ai_distress', severity: 'warning', createdAt: new Date() });
    chatList.push({ userUid: 'elder-export', distressSignals: ['loneliness'], createdAt: new Date() });
    photoAnalysisList.push({ userUid: 'elder-export', distressSignals: [], createdAt: new Date() });

    const res = await request(app)
      .post('/api/reports/weekly/user/elder-export/export')
      .set('x-dev-uid', 'care-export');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.downloadUrl).toContain('/uploads/reports/');
  });

  it('creates and lists missed call logs', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-call-id',
      uid: 'elder-call',
      fullName: 'Call Elder',
      role: 'elder',
      linkedCaretakers: ['care-call-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-call-id',
      uid: 'care-call',
      fullName: 'Call Care',
      role: 'caretaker',
      linkedElders: ['elder-call-id'],
    });

    const createRes = await request(app)
      .post('/api/calls/missed')
      .set('x-dev-uid', 'care-call')
      .send({ elderUid: 'elder-call', caretakerUid: 'care-call', type: 'video' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.callLog.status).toBe('missed');

    const listRes = await request(app)
      .get('/api/calls/user/elder-call')
      .set('x-dev-uid', 'care-call');

    expect(listRes.status).toBe(200);
    expect(listRes.body.logs.length).toBeGreaterThan(0);
  });
});
