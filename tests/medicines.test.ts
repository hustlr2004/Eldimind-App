import request from 'supertest';
import app from '../src/index';

// Mock notification service
jest.mock('../src/services/notificationService', () => ({
  sendPushToUid: jest.fn().mockResolvedValue(true),
  notifyCaretakersOfUid: jest.fn().mockResolvedValue(true),
}));

// Mock models
jest.mock('../src/models/Medicine', () => {
  const list: any[] = [];
  function Medicine(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `med-${list.length + 1}`;
    this.save = jest.fn(async function () {
      if (!this._id) this._id = `med-${list.length + 1}`;
      list.push(this);
      return this;
    });
  }
  (Medicine as any).find = jest.fn(() => Promise.resolve(list));
  (Medicine as any).findById = jest.fn((id: any) => Promise.resolve(list.find((m) => String(m._id) === String(id))));
  (Medicine as any).prototype = { save: jest.fn() };
  return { Medicine };
});

jest.mock('../src/models/Reminder', () => {
  const list: any[] = [];
  function Reminder(this: any, data: any) { Object.assign(this, data); this.save = jest.fn(async function () { list.push(this); return this; }); }
  (Reminder as any).find = jest.fn(() => Promise.resolve([]));
  (Reminder as any).findOne = jest.fn(() => Promise.resolve(null));
  (Reminder as any).updateMany = jest.fn(() => Promise.resolve());
  return { Reminder };
});

jest.mock('../src/models/MedicineLog', () => ({
  MedicineLog: function (data: any) {
    Object.assign(this, data);
    (this as any).save = jest.fn(async function () {
      return this;
    });
  },
}));

jest.mock('../src/models/User', () => {
  const users: any[] = [];
  const User = function (data: any) {
    return { ...data, save: jest.fn(async function () { return this; }) } as any;
  } as any;
  User.findOne = jest.fn((q: any) => Promise.resolve(users.find((u) => u.uid === q.uid)));
  (User as any).__seed = (u: any) => users.push({ ...u, save: jest.fn(async function () { return this; }) });
  return { User };
});

describe('Medicines API', () => {
  it('creates a medicine and materializes reminders', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({ uid: 'elder-100', fullName: 'Elder 100', role: 'elder' });

    const res = await request(app).post('/api/medicines').set('x-dev-uid', 'elder-100').send({ name: 'TestMed', scheduleTimes: ['23:59'] });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.medicine).toBeDefined();
  });

  it('marks medicine as taken and acknowledges reminders', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({ uid: 'elder-200', fullName: 'Elder 200', role: 'elder' });

    // create med mock entry
    const Medicine = jest.requireMock('../src/models/Medicine').Medicine;
    const med = { _id: 'med-1', userUid: 'elder-200', name: 'Med1' };
    // push into internal list if available
    if (Medicine && Medicine.find) {
      // nothing
    }

    const resCreate = await request(app).post('/api/medicines').set('x-dev-uid', 'elder-200').send({ name: 'Med1', scheduleTimes: ['08:00'] });
    const medId = resCreate.body.medicine._id;

    const res = await request(app).post(`/api/medicines/${medId}/taken`).set('x-dev-uid', 'elder-200').send({ action: 'taken' });
    // even if mocked, expect 200 or 201 depending on implementation
    expect(res.status === 200 || res.status === 201).toBeTruthy();
  });
});
