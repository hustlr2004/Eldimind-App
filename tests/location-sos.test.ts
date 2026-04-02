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

jest.mock('../src/models/LocationLog', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => ({
        limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
      })),
    };
  }
  function LocationLog(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `location-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (LocationLog as any).find = jest.fn((query: any) => chain(list.filter((item) => item.userUid === query.userUid)));
  return { LocationLog };
});

jest.mock('../src/models/SosEvent', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => ({
        limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
      })),
    };
  }
  function SosEvent(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `sos-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (SosEvent as any).find = jest.fn((query: any) => chain(list.filter((item) => item.userUid === query.userUid)));
  return { SosEvent };
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

describe('Location and SOS APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores and returns latest location for a linked elder', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-loc-id',
      uid: 'elder-loc',
      fullName: 'Location Elder',
      role: 'elder',
      linkedCaretakers: ['care-loc-id'],
    });
    mocked.User.__seed({
      _id: 'care-loc-id',
      uid: 'care-loc',
      fullName: 'Location Care',
      role: 'caretaker',
      linkedElders: ['elder-loc-id'],
    });

    const createRes = await request(app)
      .post('/api/location')
      .set('x-dev-uid', 'elder-loc')
      .send({ latitude: 12.9716, longitude: 77.5946, source: 'gps' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.location.latitude).toBe(12.9716);

    const latestRes = await request(app)
      .get('/api/location/user/elder-loc/latest')
      .set('x-dev-uid', 'care-loc');

    expect(latestRes.status).toBe(200);
    expect(latestRes.body.location.longitude).toBe(77.5946);
  });

  it('creates SOS event and critical alert', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-sos-id',
      uid: 'elder-sos',
      fullName: 'SOS Elder',
      role: 'elder',
      linkedCaretakers: ['care-sos-id'],
    });
    mocked.User.__seed({
      _id: 'care-sos-id',
      uid: 'care-sos',
      fullName: 'SOS Care',
      role: 'caretaker',
      linkedElders: ['elder-sos-id'],
    });

    const res = await request(app)
      .post('/api/sos')
      .set('x-dev-uid', 'elder-sos')
      .send({
        reason: 'fall',
        message: 'Need help',
        latitude: 28.6139,
        longitude: 77.209,
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.sosEvent.status).toBe('triggered');
    expect(res.body.alert.type).toBe('sos');
    expect(res.body.alert.severity).toBe('critical');
  });

  it('blocks unlinked caretaker from reading elder SOS history', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-sos-2-id',
      uid: 'elder-sos-2',
      fullName: 'SOS Elder Two',
      role: 'elder',
      linkedCaretakers: [],
    });
    mocked.User.__seed({
      _id: 'care-sos-2-id',
      uid: 'care-sos-2',
      fullName: 'SOS Care Two',
      role: 'caretaker',
      linkedElders: [],
    });

    const res = await request(app)
      .get('/api/sos/user/elder-sos-2')
      .set('x-dev-uid', 'care-sos-2');

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });
});
