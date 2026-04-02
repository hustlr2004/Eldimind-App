import request from 'supertest';
import app from '../src/index';

// Mock models
jest.mock('../src/models/LinkOtp', () => {
  const list: any[] = [];
  function LinkOtp(this: any, data: any) {
    Object.assign(this, data);
  }
  (LinkOtp as any).findOne = jest.fn((q: any) => Promise.resolve(list.find((i) => i.code === q.code)));
  (LinkOtp as any).prototype.save = jest.fn(function (this: any) {
    list.push(this);
    return Promise.resolve(this);
  });
  return { LinkOtp };
});

jest.mock('../src/models/User', () => {
  const users: any[] = [];
  const User = function (data: any) {
    return { ...data, save: jest.fn(async function () { return this; }) };
  } as any;
  User.findOne = jest.fn((q: any) => Promise.resolve(users.find((u) => u.uid === q.uid)));
  // helper to seed users - ensure save method exists on seeded objects
  (User as any).__seed = (u: any) => {
    users.push({ ...u, save: jest.fn(async function () { return this; }) });
  };
  return { User };
});

describe('Linking API (OTP)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('elder generates an OTP and caretaker verifies it', async () => {
    const mocked = jest.requireMock('../src/models/User');
    const User = mocked.User as any;
    // seed elder and caretaker
    const elder = { uid: 'elder-1', fullName: 'Elder One', role: 'elder', linkedCaretakers: [] };
    const caretaker = { uid: 'care-1', fullName: 'Care One', role: 'caretaker', linkedElders: [] };
    User.__seed(elder);
    User.__seed(caretaker);

    // Elder generates OTP
    const genRes = await request(app).post('/api/link/generate-otp').set('x-dev-uid', elder.uid).send();
    expect(genRes.status).toBe(200);
    expect(genRes.body.ok).toBe(true);
    expect(genRes.body.code).toBeDefined();

    const code = genRes.body.code;

    // Caretaker verifies
    const verifyRes = await request(app).post('/api/link/verify-otp').set('x-dev-uid', caretaker.uid).send({ code });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.ok).toBe(true);
    expect(verifyRes.body.elder.uid).toBe(elder.uid);
  });
});
