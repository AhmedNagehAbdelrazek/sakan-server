const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { User, PropertyRequest, Notification } = require('../../Models');

async function makeUser(prefix, role) {
  const rand = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return User.create({
    username: `${prefix}_${role}_${rand.slice(0, 4)}`,
    email: `${prefix}_${role}_${rand}@example.com`,
    phone: `01${rand.slice(0, 9)}`,
    password_hash: 'password',
    role,
    verified: true,
  });
}

async function makeRequest(userId, overrides = {}) {
  return PropertyRequest.create({
    userId,
    message: 'Looking for a shared flat near campus',
    propertyType: 'flat',
    requestType: 'looking',
    ...overrides,
  });
}

describe('US4: creator visibility for property requests', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let manager;
  let landlord;
  let otherLandlord;
  let student;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    admin = await makeUser('us4', 'admin');
    manager = await makeUser('us4', 'manager');
    landlord = await makeUser('us4', 'landlord');
    otherLandlord = await makeUser('us4', 'landlord');
    student = await makeUser('us4', 'student');
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('creator sees only their own requests with paginated shape', async () => {
    const r1 = await makeRequest(landlord.id);
    await makeRequest(landlord.id);
    await makeRequest(otherLandlord.id);

    const res = await request(app)
      .get('/api/property-requests/mine?page=1&limit=10')
      .set(authHeaderForUser(landlord));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((r) => r.user?.id === landlord.id)).toBe(true);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(10);
    expect(res.body.totalPages).toBe(1);

    await r1.destroy();
  });

  test('admin and manager are rejected from the personal mine view', async () => {
    const adminRes = await request(app).get('/api/property-requests/mine').set(authHeaderForUser(admin));
    expect(adminRes.status).toBe(403);

    const managerRes = await request(app).get('/api/property-requests/mine').set(authHeaderForUser(manager));
    expect(managerRes.status).toBe(403);
  });

  test('admin status change notifies the creator durably', async () => {
    const reqRecord = await makeRequest(landlord.id);

    const res = await request(app)
      .patch(`/api/property-requests/${reqRecord.id}/status`)
      .set(authHeaderForUser(admin))
      .send({ status: 'contacted' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('contacted');

    const notification = await Notification.findOne({
      where: { userId: landlord.id, notificationType: 'property_request_status' },
    });
    expect(notification).toBeTruthy();
    expect(notification.notificationContent.title).toBe('Property request status updated');
  });

  test('invalid transition pending → resolved returns 400', async () => {
    const reqRecord = await makeRequest(student.id);

    const res = await request(app)
      .patch(`/api/property-requests/${reqRecord.id}/status`)
      .set(authHeaderForUser(admin))
      .send({ status: 'resolved' });

    expect(res.status).toBe(400);
    expect((await PropertyRequest.findByPk(reqRecord.id)).status).toBe('pending');
  });

  test('creator can delete their own request', async () => {
    const reqRecord = await makeRequest(landlord.id);

    const res = await request(app)
      .delete(`/api/property-requests/${reqRecord.id}`)
      .set(authHeaderForUser(landlord));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(await PropertyRequest.findByPk(reqRecord.id)).toBeNull();
  });

  test('admin can delete any request', async () => {
    const reqRecord = await makeRequest(otherLandlord.id);

    const res = await request(app)
      .delete(`/api/property-requests/${reqRecord.id}`)
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
  });

  test('non-creator student cannot delete another user request', async () => {
    const reqRecord = await makeRequest(landlord.id);

    const res = await request(app)
      .delete(`/api/property-requests/${reqRecord.id}`)
      .set(authHeaderForUser(student));

    expect(res.status).toBe(403);

    await reqRecord.destroy();
  });

  test('manager is rejected from mutation but can read the admin list', async () => {
    const reqRecord = await makeRequest(student.id);

    const mutate = await request(app)
      .patch(`/api/property-requests/${reqRecord.id}/status`)
      .set(authHeaderForUser(manager))
      .send({ status: 'closed' });
    expect(mutate.status).toBe(403);

    const del = await request(app)
      .delete(`/api/property-requests/${reqRecord.id}`)
      .set(authHeaderForUser(manager));
    expect(del.status).toBe(403);

    const read = await request(app)
      .get('/api/property-requests?limit=10')
      .set(authHeaderForUser(manager));
    expect(read.status).toBe(200);

    await reqRecord.destroy();
  });
});
