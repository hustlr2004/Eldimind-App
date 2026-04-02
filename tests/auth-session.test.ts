import request from 'supertest';
import app from '../src/index';

jest.mock('../src/models/User', () => {
  const users: any[] = [];
  const User = function (data: any) {
    return {
      emergencyContacts: [],
      preferences: {},
      linkedCaretakers: [],
      linkedElders: [],
      ...data,
      save: jest.fn(async function () {
        const existingIndex = users.findIndex((user) => user.uid === this.uid);
        if (existingIndex >= 0) users[existingIndex] = this;
        else users.push(this);
        return this;
      }),
    } as any;
  } as any;
  User.findOne = jest.fn((query: any) => Promise.resolve(users.find((user) => user.uid === query.uid)));
  return { User };
});

describe('Auth session flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a signed session cookie and reads current user from it', async () => {
    const loginRes = await request(app)
      .post('/api/auth/session-login')
      .send({
        idToken: 'elder-session',
        rememberMe: true,
        profile: {
          fullName: 'Session Elder',
          role: 'elder',
          email: 'elder@example.com',
        },
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.ok).toBe(true);
    expect(loginRes.headers['set-cookie']?.[0]).toContain('eldimind_session=');

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', loginRes.headers['set-cookie']);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.uid).toBe('elder-session');
    expect(meRes.body.user.fullName).toBe('Session Elder');
  });
});
