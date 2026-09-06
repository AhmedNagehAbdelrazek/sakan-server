const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { User } = require('../../Models');

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

describe('US5: admin oversight of flatmate requests', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let manager;
  let student1;
  let student2;
  let requestId;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    admin = await makeUser('us5', 'admin');
    manager = await makeUser('us5', 'manager');
    student1 = await makeUser('us5', 'student');
    student2 = await makeUser('us5', 'student');

    const created = await request(app)
      .post('/api/flatmate-requests')
      .set(authHeaderForUser(student1))
      .send({ preferredBudget: 800, preferredType: 'flat', phoneNumber: '+201001234567', peopleWanted: 2, message: 'looking for a flatmate' });
    expect(created.status).toBe(201);
    requestId = created.body.id;

    const interest = await request(app)
      .post(`/api/flatmate-requests/${requestId}/join-interest`)
      .set(authHeaderForUser(student2))
      .send({ message: 'I am interested' });
    expect(interest.status).toBe(201);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('admin lists all flatmate requests with join-interest summary', async () => {
    const res = await request(app)
      .get('/api/flatmate-requests?limit=10')
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(requestId);
    expect(res.body.items[0].joinInterests).toHaveLength(1);
    expect(res.body.items[0].joinInterests[0].status).toBe('pending');
  });

  test('admin detail view includes join interests and requester info', async () => {
    const res = await request(app)
      .get(`/api/flatmate-requests/${requestId}`)
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(requestId);
    expect(res.body.joinInterests).toHaveLength(1);
    expect(res.body.joinInterests[0].requester.id).toBe(student2.id);
    expect(res.body.user.id).toBe(student1.id);
  });

  test('detail handles a request with no join interests', async () => {
    const empty = await request(app)
      .post('/api/flatmate-requests')
      .set(authHeaderForUser(student1))
      .send({ preferredBudget: 500, preferredType: 'room', phoneNumber: '+201001234568', peopleWanted: 1 });

    const res = await request(app)
      .get(`/api/flatmate-requests/${empty.body.id}`)
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(res.body.joinInterests).toEqual([]);
  });

  test('manager is allowed to read flatmate requests', async () => {
    const res = await request(app)
      .get(`/api/flatmate-requests/${requestId}`)
      .set(authHeaderForUser(manager));

    expect(res.status).toBe(200);
  });

  test('student/landlord are rejected from the admin list', async () => {
    const res = await request(app)
      .get('/api/flatmate-requests')
      .set(authHeaderForUser(student1));

    expect(res.status).toBe(403);
  });
});
