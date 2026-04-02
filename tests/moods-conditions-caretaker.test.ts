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
  User.findOne = jest.fn((query: any) => {
    if (query.uid) return Promise.resolve(users.find((user) => user.uid === query.uid));
    return Promise.resolve(undefined);
  });
  (User as any).__seed = (user: any) => users.push({ ...user, save: jest.fn(async function () { return this; }) });
  return { User };
});

jest.mock('../src/models/MoodLog', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => ({
        limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
      })),
    };
  }
  function MoodLog(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `mood-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (MoodLog as any).find = jest.fn((query: any) => chain(list.filter((item) => item.userUid === query.userUid)));
  return { MoodLog };
});

jest.mock('../src/models/Condition', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => Promise.resolve(items)),
    };
  }
  function Condition(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `condition-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (Condition as any).find = jest.fn((query: any) => chain(list.filter((item) => item.userUid === query.userUid)));
  return { Condition };
});

jest.mock('../src/models/Vital', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => ({
        limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
      })),
    };
  }
  function Vital(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `vital-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (Vital as any).find = jest.fn((query: any) => chain(list.filter((item) => item.userUid === query.userUid)));
  return { Vital };
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

describe('Mood, condition, and caretaker overview APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates and lists mood logs for a linked elder', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-mood-id',
      uid: 'elder-mood',
      fullName: 'Mood Elder',
      role: 'elder',
      linkedCaretakers: ['care-mood-id'],
    });
    mocked.User.__seed({
      _id: 'care-mood-id',
      uid: 'care-mood',
      fullName: 'Mood Care',
      role: 'caretaker',
      linkedElders: ['elder-mood-id'],
    });

    const createRes = await request(app)
      .post('/api/moods')
      .set('x-dev-uid', 'care-mood')
      .send({ userUid: 'elder-mood', mood: 2, note: 'Looked low today' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.ok).toBe(true);

    const listRes = await request(app)
      .get('/api/moods/user/elder-mood')
      .set('x-dev-uid', 'care-mood');

    expect(listRes.status).toBe(200);
    expect(listRes.body.moodLogs[0].mood).toBe(2);
  });

  it('creates and lists conditions for a linked elder', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-cond-id',
      uid: 'elder-cond',
      fullName: 'Condition Elder',
      role: 'elder',
      linkedCaretakers: ['care-cond-id'],
    });
    mocked.User.__seed({
      _id: 'care-cond-id',
      uid: 'care-cond',
      fullName: 'Condition Care',
      role: 'caretaker',
      linkedElders: ['elder-cond-id'],
    });

    const createRes = await request(app)
      .post('/api/conditions')
      .set('x-dev-uid', 'care-cond')
      .send({ userUid: 'elder-cond', name: 'Hypertension', notes: 'Monitor daily' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.condition.name).toBe('Hypertension');

    const listRes = await request(app)
      .get('/api/conditions/user/elder-cond')
      .set('x-dev-uid', 'care-cond');

    expect(listRes.status).toBe(200);
    expect(listRes.body.conditions[0].name).toBe('Hypertension');
  });

  it('returns caretaker overview for a linked elder', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-over-id',
      uid: 'elder-over',
      fullName: 'Overview Elder',
      role: 'elder',
      photoUrl: 'https://example.com/elder.jpg',
      lastActiveAt: '2026-04-02T10:00:00.000Z',
      linkedCaretakers: ['care-over-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-over-id',
      uid: 'care-over',
      fullName: 'Overview Care',
      role: 'caretaker',
      linkedElders: ['elder-over-id'],
    });

    const MoodLog = jest.requireMock('../src/models/MoodLog').MoodLog;
    const Condition = jest.requireMock('../src/models/Condition').Condition;
    const Vital = jest.requireMock('../src/models/Vital').Vital;
    const Alert = jest.requireMock('../src/models/Alert').Alert;

    await new MoodLog({
      userUid: 'elder-over',
      recordedByUid: 'elder-over',
      mood: 2,
      note: 'Felt weak',
      recordedAt: '2026-04-02T09:00:00.000Z',
    }).save();
    await new Condition({
      userUid: 'elder-over',
      addedByUid: 'care-over',
      name: 'Diabetes Type 2',
      active: true,
    }).save();
    await new Vital({
      userUid: 'elder-over',
      recordedByUid: 'elder-over',
      heartRate: 88,
      spo2: 96,
      recordedAt: '2026-04-02T08:00:00.000Z',
    }).save();
    await new Alert({
      userUid: 'elder-over',
      type: 'vital_spike',
      severity: 'warning',
      title: 'Check-in needed',
      description: 'Watch readings closely',
      createdAt: '2026-04-02T09:30:00.000Z',
    }).save();

    const res = await request(app)
      .get('/api/caretaker/elders/elder-over/overview')
      .set('x-dev-uid', 'care-over');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.overview.elder.fullName).toBe('Overview Elder');
    expect(res.body.overview.todayMood.label).toBe('Sad');
    expect(res.body.overview.latestVitals.heartRate).toBe(88);
    expect(res.body.overview.conditions[0].name).toBe('Diabetes Type 2');
    expect(res.body.overview.statusChip).toBe('Needs Attention');
  });

  it('blocks overview access for an unlinked caretaker', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-no-link-id',
      uid: 'elder-no-link',
      fullName: 'Unlinked Elder',
      role: 'elder',
      linkedCaretakers: [],
    });
    mocked.User.__seed({
      _id: 'care-no-link-id',
      uid: 'care-no-link',
      fullName: 'Unlinked Care',
      role: 'caretaker',
      linkedElders: [],
    });

    const res = await request(app)
      .get('/api/caretaker/elders/elder-no-link/overview')
      .set('x-dev-uid', 'care-no-link');

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });
});
