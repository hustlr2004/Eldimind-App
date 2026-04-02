import request from 'supertest';
import app from '../src/index';

jest.mock('axios', () => ({
  get: jest.fn(async () => ({
    data: Buffer.from('fake-image'),
    headers: { 'content-type': 'image/jpeg' },
  })),
  post: jest.fn(async () => ({
    data: {
      responseId: 'gm-photo-1',
      candidates: [
        {
          content: {
            parts: [{ text: 'Friendly summary.\nCaregiver note: Looks slightly sad.' }],
          },
        },
      ],
    },
  })),
}));

jest.mock('../src/models/User', () => {
  const users: any[] = [];
  const User = function (data: any) {
    return { emergencyContacts: [], preferences: {}, ...data, save: jest.fn(async function () { return this; }) } as any;
  } as any;
  User.findOne = jest.fn((query: any) => Promise.resolve(users.find((user) => user.uid === query.uid)));
  (User as any).__seed = (user: any) => users.push({ emergencyContacts: [], preferences: {}, ...user, save: jest.fn(async function () { return this; }) });
  return { User };
});

jest.mock('../src/models/PhotoJournal', () => {
  const list: any[] = [];
  function chain(items: any[]) {
    return {
      sort: jest.fn(() => ({
        limit: jest.fn((n: number) => Promise.resolve(items.slice(0, n))),
      })),
    };
  }
  function PhotoJournal(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `pj-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (PhotoJournal as any).find = jest.fn((query: any) => chain(list.filter((item) => item.userUid === query.userUid)));
  return { PhotoJournal };
});

jest.mock('../src/models/PhotoAnalysis', () => {
  const list: any[] = [];
  function PhotoAnalysis(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || `pa-${list.length + 1}`;
    this.save = jest.fn(async function () {
      list.unshift(this);
      return this;
    });
  }
  (PhotoAnalysis as any).find = jest.fn((query: any) => ({
    sort: jest.fn(() => ({
      limit: jest.fn((n: number) => Promise.resolve(list.filter((item) => item.userUid === query.userUid).slice(0, n))),
    })),
  }));
  return { PhotoAnalysis };
});

jest.mock('../src/models/Alert', () => {
  function Alert(this: any, data: any) {
    Object.assign(this, data);
    this._id = this._id || 'alert-1';
    this.save = jest.fn(async function () { return this; });
  }
  (Alert as any).find = jest.fn(() => ({
    sort: jest.fn(() => ({
      limit: jest.fn(() => Promise.resolve([])),
    })),
  }));
  return { Alert };
});

describe('Photo journal API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads a base64 photo and stores a local photo record', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-photo-up-id',
      uid: 'elder-photo-up',
      fullName: 'Upload Elder',
      role: 'elder',
      linkedCaretakers: [],
      linkedElders: [],
    });

    const imageBase64 = Buffer.from('fake-image').toString('base64');
    const res = await request(app)
      .post('/api/photos')
      .set('x-dev-uid', 'elder-photo-up')
      .send({ imageBase64, mimeType: 'image/jpeg', caption: 'Morning walk' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.photo.storageType).toBe('local');
    expect(res.body.photo.imageUrl).toContain('/uploads/photos/');
  });

  it('uploads and analyzes a remote photo for a linked elder', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-photo-linked-id',
      uid: 'elder-photo-linked',
      fullName: 'Linked Elder',
      role: 'elder',
      linkedCaretakers: ['care-photo-linked-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-photo-linked-id',
      uid: 'care-photo-linked',
      fullName: 'Linked Care',
      role: 'caretaker',
      linkedElders: ['elder-photo-linked-id'],
    });

    const res = await request(app)
      .post('/api/photos')
      .set('x-dev-uid', 'care-photo-linked')
      .send({
        userUid: 'elder-photo-linked',
        imageUrl: 'https://example.com/photo.jpg',
        analyze: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.photo.storageType).toBe('remote');
    expect(res.body.photoAnalysis.summary).toBeDefined();
  });

  it('lists gallery photos for a linked elder', async () => {
    const mockedUsers = jest.requireMock('../src/models/User');
    mockedUsers.User.__seed({
      _id: 'elder-gallery-id',
      uid: 'elder-gallery',
      fullName: 'Gallery Elder',
      role: 'elder',
      linkedCaretakers: ['care-gallery-id'],
    });
    mockedUsers.User.__seed({
      _id: 'care-gallery-id',
      uid: 'care-gallery',
      fullName: 'Gallery Care',
      role: 'caretaker',
      linkedElders: ['elder-gallery-id'],
    });

    const imageBase64 = Buffer.from('fake-image').toString('base64');
    await request(app)
      .post('/api/photos')
      .set('x-dev-uid', 'elder-gallery')
      .send({ imageBase64, mimeType: 'image/jpeg' });

    const res = await request(app)
      .get('/api/photos/user/elder-gallery')
      .set('x-dev-uid', 'care-gallery');

    expect(res.status).toBe(200);
    expect(res.body.photos.length).toBeGreaterThan(0);
  });
});
