import request from 'supertest';
import app from '../src/index';

jest.mock('../src/services/notificationService', () => ({
  sendPushToUid: jest.fn().mockResolvedValue(true),
  notifyCaretakersOfUid: jest.fn().mockResolvedValue(true),
}));

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

describe('Vitals API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a vital reading and critical alert for an elder', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-1-id',
      uid: 'elder-1',
      fullName: 'Elder One',
      role: 'elder',
      linkedCaretakers: ['care-1-id'],
    });
    mocked.User.__seed({
      _id: 'care-1-id',
      uid: 'care-1',
      fullName: 'Care One',
      role: 'caretaker',
      linkedElders: ['elder-1-id'],
    });

    const res = await request(app)
      .post('/api/vitals')
      .set('x-dev-uid', 'elder-1')
      .send({ heartRate: 132, source: 'manual' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.vital.userUid).toBe('elder-1');
    expect(res.body.alerts).toHaveLength(1);
    expect(res.body.alerts[0].type).toBe('vital_spike');
  });

  it('allows a linked caretaker to record and read vitals for an elder', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-2-id',
      uid: 'elder-2',
      fullName: 'Elder Two',
      role: 'elder',
      linkedCaretakers: ['care-2-id'],
    });
    mocked.User.__seed({
      _id: 'care-2-id',
      uid: 'care-2',
      fullName: 'Care Two',
      role: 'caretaker',
      linkedElders: ['elder-2-id'],
    });

    const createRes = await request(app)
      .post('/api/vitals')
      .set('x-dev-uid', 'care-2')
      .send({ userUid: 'elder-2', spo2: 97, source: 'manual' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.vital.userUid).toBe('elder-2');

    const listRes = await request(app)
      .get('/api/vitals/user/elder-2')
      .set('x-dev-uid', 'care-2');

    expect(listRes.status).toBe(200);
    expect(listRes.body.ok).toBe(true);
    expect(listRes.body.vitals.length).toBeGreaterThan(0);
  });

  it('blocks an unlinked caretaker from accessing elder vitals', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-3-id',
      uid: 'elder-3',
      fullName: 'Elder Three',
      role: 'elder',
      linkedCaretakers: [],
    });
    mocked.User.__seed({
      _id: 'care-3-id',
      uid: 'care-3',
      fullName: 'Care Three',
      role: 'caretaker',
      linkedElders: [],
    });

    const res = await request(app)
      .get('/api/vitals/user/elder-3')
      .set('x-dev-uid', 'care-3');

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });
});
