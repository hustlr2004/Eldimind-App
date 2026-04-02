import request from 'supertest';
import app from '../src/index';

jest.mock('axios', () => ({
  post: jest.fn(async (url: string, payload: any) => {
    if (url.includes('/risk-score')) {
      if (payload.userUid === 'elder-fallback') {
        throw new Error('ML service offline');
      }
      return {
        data: {
          ok: true,
          userUid: payload.userUid,
          riskScore: 72,
          riskLevel: 'high',
          reasons: ['critical heart rate', 'low mood'],
          activityLog: ['1200 steps recorded', 'Resting heart rate around 122 bpm'],
          adjustedThresholdHints: {
            highRiskMonitoring: true,
            extraCareForConditions: ['Hypertension'],
          },
        },
      };
    }
    return { data: {} };
  }),
}));

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

jest.mock('../src/models/Vital', () => {
  const list: any[] = [];
  function Vital(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (Vital as any).find = jest.fn((query: any) => ({
    sort: jest.fn(() => ({
      limit: jest.fn((n: number) => Promise.resolve(list.filter((item) => item.userUid === query.userUid).slice(0, n))),
    })),
  }));
  return { Vital };
});

jest.mock('../src/models/MoodLog', () => {
  const list: any[] = [];
  function MoodLog(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (MoodLog as any).find = jest.fn((query: any) => ({
    sort: jest.fn(() => ({
      limit: jest.fn((n: number) => Promise.resolve(list.filter((item) => item.userUid === query.userUid).slice(0, n))),
    })),
  }));
  return { MoodLog };
});

jest.mock('../src/models/Condition', () => {
  const list: any[] = [];
  function Condition(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (Condition as any).find = jest.fn((query: any) => ({
    sort: jest.fn(() => Promise.resolve(list.filter((item) => item.userUid === query.userUid))),
  }));
  return { Condition };
});

jest.mock('../src/models/Alert', () => {
  const list: any[] = [];
  function Alert(this: any, data: any) {
    Object.assign(this, data);
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (Alert as any).find = jest.fn((query: any) => ({
    sort: jest.fn(() => ({
      limit: jest.fn((n: number) => Promise.resolve(list.filter((item) => item.userUid === query.userUid).slice(0, n))),
    })),
  }));
  return { Alert };
});

describe('ML integration API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ML-backed risk scoring for a linked elder', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    const Vital = jest.requireMock('../src/models/Vital').Vital;
    const MoodLog = jest.requireMock('../src/models/MoodLog').MoodLog;
    const Condition = jest.requireMock('../src/models/Condition').Condition;
    const Alert = jest.requireMock('../src/models/Alert').Alert;

    mockedUsers.User.__seed({
      _id: 'elder-ml-id',
      uid: 'elder-ml',
      fullName: 'ML Elder',
      role: 'elder',
      linkedCaretakers: ['care-ml-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-ml-id',
      uid: 'care-ml',
      fullName: 'ML Care',
      role: 'caretaker',
      linkedElders: ['elder-ml-id'],
    });

    await new Vital({ userUid: 'elder-ml', heartRate: 122 }).save();
    await new MoodLog({ userUid: 'elder-ml', mood: 2 }).save();
    await new Condition({ userUid: 'elder-ml', name: 'Hypertension', active: true }).save();
    await new Alert({ userUid: 'elder-ml', type: 'vital_spike', severity: 'critical' }).save();

    const res = await request(app)
      .get('/api/ml/risk/user/elder-ml')
      .set('x-dev-uid', 'care-ml');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.prediction.riskLevel).toBe('high');
    expect(res.body.prediction.riskScore).toBe(72);
  });

  it('falls back to local scoring when the ML service is unavailable', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    const Vital = jest.requireMock('../src/models/Vital').Vital;
    const MoodLog = jest.requireMock('../src/models/MoodLog').MoodLog;
    const Condition = jest.requireMock('../src/models/Condition').Condition;
    const Alert = jest.requireMock('../src/models/Alert').Alert;

    mockedUsers.User.__seed({
      _id: 'elder-fallback-id',
      uid: 'elder-fallback',
      fullName: 'Fallback Elder',
      role: 'elder',
      linkedCaretakers: ['care-fallback-id'],
      preferences: {
        notifications: {
          enabled: true,
          doNotDisturbStart: '22:00',
          doNotDisturbEnd: '06:00',
        },
      },
    });
    mockedUsers.User.__seed({
      _id: 'care-fallback-id',
      uid: 'care-fallback',
      fullName: 'Fallback Care',
      role: 'caretaker',
      linkedElders: ['elder-fallback-id'],
    });

    await new Vital({ userUid: 'elder-fallback', heartRate: 130, spo2: 89 }).save();
    await new MoodLog({ userUid: 'elder-fallback', mood: 1 }).save();
    await new Condition({ userUid: 'elder-fallback', name: 'Hypertension', active: true }).save();
    await new Alert({ userUid: 'elder-fallback', type: 'vital_spike', severity: 'critical' }).save();

    const res = await request(app)
      .get('/api/ml/risk/user/elder-fallback')
      .set('x-dev-uid', 'care-fallback');

    expect(res.status).toBe(200);
    expect(res.body.prediction.source).toBe('fallback');
    expect(res.body.prediction.riskLevel).toBeDefined();
    expect(res.body.notificationGuidance.doNotDisturbConfigured).toBe(true);
  });
});
