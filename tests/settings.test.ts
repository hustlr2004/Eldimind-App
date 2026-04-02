import request from 'supertest';
import app from '../src/index';

jest.mock('../src/models/User', () => {
  const users: any[] = [];
  const User = function (data: any) {
    return { ...data, save: jest.fn(async function () { return this; }) } as any;
  } as any;
  User.findOne = jest.fn((query: any) => Promise.resolve(users.find((user) => user.uid === query.uid)));
  (User as any).__seed = (user: any) =>
    users.push({
      emergencyContacts: [],
      preferences: {},
      ...user,
      save: jest.fn(async function () {
        return this;
      }),
    });
  return { User };
});

describe('Settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates and returns own preferences', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-settings-id',
      uid: 'elder-settings',
      fullName: 'Settings Elder',
      role: 'elder',
      linkedCaretakers: [],
      linkedElders: [],
    });

    const patchRes = await request(app)
      .patch('/api/settings/me')
      .set('x-dev-uid', 'elder-settings')
      .send({
        language: 'hi',
        theme: 'high_contrast',
        fontSize: 'extra_large',
        fallSensitivity: 'high',
        notifications: {
          sound: false,
          vibration: true,
        },
        deviceConnections: {
          googleFit: { status: 'connected', lastSyncAt: '2026-04-02T10:00:00.000Z' },
        },
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.preferences.language).toBe('hi');
    expect(patchRes.body.preferences.theme).toBe('high_contrast');
    expect(patchRes.body.preferences.deviceConnections.googleFit.status).toBe('connected');
  });

  it('adds and removes emergency contacts', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-contact-id',
      uid: 'elder-contact',
      fullName: 'Contact Elder',
      role: 'elder',
      linkedCaretakers: [],
      linkedElders: [],
    });

    const addRes = await request(app)
      .post('/api/settings/emergency-contacts')
      .set('x-dev-uid', 'elder-contact')
      .send({ name: 'Daughter', phone: '+911234567890', relationship: 'daughter' });

    expect(addRes.status).toBe(201);
    expect(addRes.body.emergencyContacts).toHaveLength(1);

    const deleteRes = await request(app)
      .delete('/api/settings/emergency-contacts/0')
      .set('x-dev-uid', 'elder-contact');

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.emergencyContacts).toHaveLength(0);
  });

  it('allows linked caretaker to read elder settings', async () => {
    const mocked = jest.requireMock('../src/models/User');
    mocked.User.__seed({
      _id: 'elder-read-id',
      uid: 'elder-read',
      fullName: 'Read Elder',
      role: 'elder',
      linkedCaretakers: ['care-read-id'],
      preferences: { language: 'kn' },
      emergencyContacts: [{ name: 'Son', phone: '+910000000000', relationship: 'son' }],
    });
    mocked.User.__seed({
      _id: 'care-read-id',
      uid: 'care-read',
      fullName: 'Read Care',
      role: 'caretaker',
      linkedElders: ['elder-read-id'],
      linkedCaretakers: [],
    });

    const res = await request(app)
      .get('/api/settings/user/elder-read')
      .set('x-dev-uid', 'care-read');

    expect(res.status).toBe(200);
    expect(res.body.preferences.language).toBe('kn');
    expect(res.body.emergencyContacts).toHaveLength(1);
  });
});
