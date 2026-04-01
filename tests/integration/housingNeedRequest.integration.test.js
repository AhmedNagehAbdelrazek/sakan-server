const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const {
  User,
  UserProfile,
  HousingNeedRequest,
} = require('../../Models');

const {
  describe,
  beforeAll,
  afterAll,
  test,
  expect,
} = require('@jest/globals');

describe('Housing Need Requests integration', () => {
  let app;
  let admin;
  let studentA;
  let studentB;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    admin = await User.create({
      username: 'admin_hnr_1',
      email: 'admin_hnr_1@example.com',
      phone: '01000002001',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    studentA = await User.create({
      username: 'student_hnr_a',
      email: 'student_hnr_a@example.com',
      phone: '01000002002',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    studentB = await User.create({
      username: 'student_hnr_b',
      email: 'student_hnr_b@example.com',
      phone: '01000002003',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    await UserProfile.create({
      userId: studentA.id,
      firstName: 'Sara',
      lastName: 'Ali',
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('student can submit a valid housing need request', async () => {
    const res = await request(app)
      .post('/api/housing-requests')
      .set(authHeaderForUser(studentA))
      .send({
        area: 'Nasr City',
        housingType: 'room',
        message: 'Need a room close to university transport.',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        area: 'Nasr City',
        housingType: 'room',
        status: 'submitted',
        cooldownDays: 7,
      })
    );
  });

  test('submission validation rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/housing-requests')
      .set(authHeaderForUser(studentA))
      .send({
        area: '',
        housingType: 'room',
        message: '',
      });

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('duplicate request is blocked for same student/normalized area/housingType within 7 days', async () => {
    const first = await request(app)
      .post('/api/housing-requests')
      .set(authHeaderForUser(studentB))
      .send({
        area: ' Dokki ',
        housingType: 'flat',
        message: 'Need a flat in Dokki for this semester.',
      });

    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/housing-requests')
      .set(authHeaderForUser(studentB))
      .send({
        area: 'dokki',
        housingType: 'flat',
        message: 'Another request in same area/type should be blocked.',
      });

    expect(second.status).toBe(409);
    expect(String(second.body.message || '')).toContain('cooldown');
  });

  test('admin cannot use student submission endpoint', async () => {
    const res = await request(app)
      .post('/api/housing-requests')
      .set(authHeaderForUser(admin))
      .send({
        area: 'Maadi',
        housingType: 'room',
        message: 'Should be rejected for admin role.',
      });

    expect(res.status).toBe(403);
  });

  test('newly submitted request is immediately visible in admin list', async () => {
    const area = `Immediate-${Date.now()}`;

    const created = await request(app)
      .post('/api/housing-requests')
      .set(authHeaderForUser(studentA))
      .send({
        area,
        housingType: 'either',
        message: 'Testing immediate visibility in admin list.',
      });

    expect(created.status).toBe(201);

    const listed = await request(app)
      .get('/api/housing-requests')
      .query({ area })
      .set(authHeaderForUser(admin));

    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body.items)).toBe(true);
    expect(listed.body.items.some((item) => item.id === created.body.id)).toBe(true);
  });

  test('admin list includes requester details and full-name fallback behavior', async () => {
    const reqA = await HousingNeedRequest.create({
      userId: studentA.id,
      area: 'Zamalek',
      areaNormalized: 'zamalek',
      housingType: 'room',
      message: 'Need room in Zamalek',
      status: 'submitted',
    });

    const reqB = await HousingNeedRequest.create({
      userId: studentB.id,
      area: 'Heliopolis',
      areaNormalized: 'heliopolis',
      housingType: 'flat',
      message: 'Need flat in Heliopolis',
      status: 'submitted',
    });

    await reqA.update({ createdat: new Date(Date.now() - 2 * 60 * 1000) });
    await reqB.update({ createdat: new Date(Date.now() - 1 * 60 * 1000) });

    const res = await request(app)
      .get('/api/housing-requests')
      .query({ page: 1, limit: 20 })
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);

    const itemA = res.body.items.find((i) => i.id === reqA.id);
    const itemB = res.body.items.find((i) => i.id === reqB.id);

    expect(itemA).toBeDefined();
    expect(itemA.requester).toEqual(
      expect.objectContaining({
        fullName: 'Sara Ali',
        email: studentA.email,
        phone: studentA.phone,
      })
    );

    expect(itemB).toBeDefined();
    expect(itemB.requester).toEqual(
      expect.objectContaining({
        fullName: studentB.username,
        email: studentB.email,
        phone: studentB.phone,
      })
    );
  });

  test('student cannot access admin list endpoint', async () => {
    const res = await request(app)
      .get('/api/housing-requests')
      .set(authHeaderForUser(studentA));

    expect(res.status).toBe(403);
  });

  test('admin status transitions allow submitted->reviewed->closed and block invalid direct close', async () => {
    const created = await request(app)
      .post('/api/housing-requests')
      .set(authHeaderForUser(studentA))
      .send({
        area: `Transition-${Date.now()}`,
        housingType: 'room',
        message: 'Lifecycle transition request.',
      });

    expect(created.status).toBe(201);

    const reviewed = await request(app)
      .patch(`/api/housing-requests/${created.body.id}/status`)
      .set(authHeaderForUser(admin))
      .send({ status: 'reviewed' });

    expect(reviewed.status).toBe(200);
    expect(reviewed.body.status).toBe('reviewed');

    const closed = await request(app)
      .patch(`/api/housing-requests/${created.body.id}/status`)
      .set(authHeaderForUser(admin))
      .send({ status: 'closed' });

    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('closed');

    const another = await request(app)
      .post('/api/housing-requests')
      .set(authHeaderForUser(studentA))
      .send({
        area: `DirectClose-${Date.now()}`,
        housingType: 'room',
        message: 'Trying invalid direct close transition.',
      });

    expect(another.status).toBe(201);

    const invalidClose = await request(app)
      .patch(`/api/housing-requests/${another.body.id}/status`)
      .set(authHeaderForUser(admin))
      .send({ status: 'closed' });

    expect(invalidClose.status).toBe(400);
  });

  test('admin list can include area demand summary counts', async () => {
    await HousingNeedRequest.create({
      userId: studentA.id,
      area: 'Agouza',
      areaNormalized: 'agouza',
      housingType: 'room',
      message: 'Demand 1 for Agouza',
      status: 'submitted',
    });

    await HousingNeedRequest.create({
      userId: studentB.id,
      area: '  agouza  ',
      areaNormalized: 'agouza',
      housingType: 'flat',
      message: 'Demand 2 for Agouza',
      status: 'submitted',
    });

    const res = await request(app)
      .get('/api/housing-requests')
      .query({ includeDemandSummary: true })
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.demandSummary)).toBe(true);

    const agouza = res.body.demandSummary.find((d) => d.areaNormalized === 'agouza');
    expect(agouza).toBeDefined();
    expect(agouza.count).toBeGreaterThanOrEqual(2);
  });

  test('student request history endpoint is not available in this feature version', async () => {
    const res = await request(app)
      .get('/api/housing-requests/mine')
      .set(authHeaderForUser(studentA));

    expect(res.status).toBe(404);
  });
});
