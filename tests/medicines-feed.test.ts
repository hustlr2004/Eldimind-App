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

jest.mock('../src/models/Medicine', () => {
  const list: any[] = [];
  function Medicine(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `med-${list.length + 1}`;
    this.save = jest.fn(async function () {
      if (!list.find((item) => String(item._id) === String(this._id))) {
        list.unshift(this);
      }
      return this;
    });
  }
  (Medicine as any).find = jest.fn((query: any) =>
    Promise.resolve(list.filter((item) => item.userUid === query.userUid))
  );
  (Medicine as any).findById = jest.fn((id: any) =>
    Promise.resolve(list.find((item) => String(item._id) === String(id)))
  );
  (Medicine as any).findByIdAndUpdate = jest.fn((id: any, update: any) => {
    const medicine = list.find((item) => String(item._id) === String(id));
    if (!medicine) return Promise.resolve(null);
    Object.assign(medicine, update.$set);
    return Promise.resolve(medicine);
  });
  (Medicine as any).findByIdAndDelete = jest.fn((id: any) => {
    const index = list.findIndex((item) => String(item._id) === String(id));
    if (index >= 0) list.splice(index, 1);
    return Promise.resolve();
  });
  return { Medicine };
});

jest.mock('../src/models/Reminder', () => {
  const list: any[] = [];
  function Reminder(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `rem-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (Reminder as any).find = jest.fn(() => Promise.resolve([]));
  (Reminder as any).findOne = jest.fn(() => Promise.resolve(null));
  (Reminder as any).updateMany = jest.fn(() => Promise.resolve());
  (Reminder as any).deleteMany = jest.fn((query: any) => {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (String(list[i].medicineId) === String(query.medicineId)) {
        list.splice(i, 1);
      }
    }
    return Promise.resolve();
  });
  return { Reminder };
});

jest.mock('../src/models/MedicineLog', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => ({
        limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
      })),
    };
  }
  function MedicineLog(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `medlog-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (MedicineLog as any).find = jest.fn((query: any) => {
    if (query.medicineId) {
      return chain(list.filter((item) => String(item.medicineId) === String(query.medicineId)));
    }
    if (query.userUid) {
      return chain(list.filter((item) => item.userUid === query.userUid));
    }
    return chain(list);
  });
  (MedicineLog as any).deleteMany = jest.fn((query: any) => {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (String(list[i].medicineId) === String(query.medicineId)) {
        list.splice(i, 1);
      }
    }
    return Promise.resolve();
  });
  return { MedicineLog };
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

describe('Expanded medicines and caretaker feed APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates medicine and returns history to a linked caretaker', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-med-id',
      uid: 'elder-med',
      fullName: 'Medicine Elder',
      role: 'elder',
      linkedCaretakers: ['care-med-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-med-id',
      uid: 'care-med',
      fullName: 'Medicine Care',
      role: 'caretaker',
      linkedElders: ['elder-med-id'],
    });

    const createRes = await request(app)
      .post('/api/medicines')
      .set('x-dev-uid', 'care-med')
      .send({ userUid: 'elder-med', name: 'Aspirin', scheduleTimes: ['08:00'] });

    const medicineId = createRes.body.medicine._id;

    const updateRes = await request(app)
      .patch(`/api/medicines/${medicineId}`)
      .set('x-dev-uid', 'care-med')
      .send({ dosage: '100mg', notes: 'After breakfast', scheduleTimes: ['09:00'] });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.medicine.dosage).toBe('100mg');

    await request(app)
      .post(`/api/medicines/${medicineId}/taken`)
      .set('x-dev-uid', 'care-med')
      .send({ action: 'taken' });

    const historyRes = await request(app)
      .get(`/api/medicines/${medicineId}/history`)
      .set('x-dev-uid', 'care-med');

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.logs.length).toBeGreaterThan(0);
  });

  it('deletes a medicine for a linked elder', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-del-id',
      uid: 'elder-del',
      fullName: 'Delete Elder',
      role: 'elder',
      linkedCaretakers: ['care-del-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-del-id',
      uid: 'care-del',
      fullName: 'Delete Care',
      role: 'caretaker',
      linkedElders: ['elder-del-id'],
    });

    const createRes = await request(app)
      .post('/api/medicines')
      .set('x-dev-uid', 'care-del')
      .send({ userUid: 'elder-del', name: 'Vitamin D', scheduleTimes: ['10:00'] });

    const medicineId = createRes.body.medicine._id;

    const deleteRes = await request(app)
      .delete(`/api/medicines/${medicineId}`)
      .set('x-dev-uid', 'care-del');

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);
  });

  it('returns a unified caretaker feed', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-feed-id',
      uid: 'elder-feed',
      fullName: 'Feed Elder',
      role: 'elder',
      linkedCaretakers: ['care-feed-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-feed-id',
      uid: 'care-feed',
      fullName: 'Feed Care',
      role: 'caretaker',
      linkedElders: ['elder-feed-id'],
    });

    const Medicine = jest.requireMock('../src/models/Medicine').Medicine;
    const Alert = jest.requireMock('../src/models/Alert').Alert;
    const MoodLog = jest.requireMock('../src/models/MoodLog').MoodLog;
    const MedicineLog = jest.requireMock('../src/models/MedicineLog').MedicineLog;
    const SosEvent = jest.requireMock('../src/models/SosEvent').SosEvent;

    const medicine = new Medicine({ userUid: 'elder-feed', name: 'BP Med', scheduleTimes: ['08:00'] });
    await medicine.save();
    await new Alert({
      userUid: 'elder-feed',
      severity: 'critical',
      title: 'Critical alert',
      description: 'Immediate attention needed',
      createdAt: '2026-04-02T10:00:00.000Z',
    }).save();
    await new MoodLog({
      userUid: 'elder-feed',
      mood: 2,
      note: 'Low energy',
      recordedAt: '2026-04-02T09:30:00.000Z',
    }).save();
    await new MedicineLog({
      userUid: 'elder-feed',
      medicineId: medicine._id,
      action: 'skipped',
      timestamp: '2026-04-02T09:00:00.000Z',
    }).save();
    await new SosEvent({
      userUid: 'elder-feed',
      message: 'Need urgent help',
      triggeredAt: '2026-04-02T10:30:00.000Z',
    }).save();

    const res = await request(app)
      .get('/api/feed/user/elder-feed')
      .set('x-dev-uid', 'care-feed');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.feed.length).toBeGreaterThan(0);
    expect(res.body.feed[0].type).toBe('sos');
  });
});
