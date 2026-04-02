import request from 'supertest';
import app from '../src/index';

// Mock the User model to avoid requiring a real MongoDB in tests
jest.mock('../src/models/User', () => {
  const mockSave = jest.fn();
  const MockUser: any = function (data: any) {
    return { ...data, save: mockSave };
  };
  MockUser.findOne = jest.fn();
  MockUser.findOneAndUpdate = jest.fn();
  MockUser.deleteMany = jest.fn();
  return { User: MockUser, __mockSave: mockSave };
});

describe('Users API (mocked DB)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a user via POST /api/users and returns 201', async () => {
    const payload = { uid: 'uid-123', fullName: 'Test Elder', role: 'elder', email: 'test@example.com' };
    const mocked = jest.requireMock('../src/models/User');
    const MockUser = mocked.User as any;
    const mockSave = mocked.__mockSave as jest.Mock;

    // Simulate findOne -> null and save returning the saved user
    (MockUser.findOne as jest.Mock).mockResolvedValue(null);
    mockSave.mockResolvedValue({ uid: payload.uid, fullName: payload.fullName, role: payload.role });

    const res = await request(app).post('/api/users').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.uid).toBe(payload.uid);
  });

  it('returns current user via GET /api/users/me with x-dev-uid header', async () => {
    const uid = 'uid-abc';
    const mocked = jest.requireMock('../src/models/User');
    const MockUser = mocked.User as any;
    const returnedUser = { uid, fullName: 'Dev User', role: 'caretaker' };
    (MockUser.findOne as jest.Mock).mockResolvedValue(returnedUser);

    const res = await request(app).get('/api/users/me').set('x-dev-uid', uid);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.uid).toBe(uid);
  });
});
