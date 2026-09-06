const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { User } = require('../../Models');

describe('OTP-free signup, property city filter and flatmate request contact phone', () => {
  jestObject.setTimeout(30000);

  let app;
  let registered;
  let admin;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    admin = await User.create({
      username: 'feat_admin',
      email: 'feat_admin@example.com',
      phone: '01000000091',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('register verifies the account and returns a usable token without OTP', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'feat_student',
        email: 'feat_student@example.com',
        password: 'password123',
        phone: '01000000092',
        role: 'student',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ username: 'feat_student', verified: true });

    registered = res.body;

    const me = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${registered.token}`);
    expect(me.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'feat_student@example.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty('token');
  });

  test('property creation requires city and search filters by it', async () => {
    const missingCity = await request(app)
      .post('/api/properties')
      .set(authHeaderForUser({ id: registered.user.id, role: 'student' }))
      .send({
        title: 'No city',
        description: 'desc',
        pricePerMonth: 900,
        totalRooms: 2,
        availableRooms: 1,
        type: 'flat',
        amenities: {},
      });
    expect(missingCity.status).toBe(400);

    const created = await request(app)
      .post('/api/properties')
      .set(authHeaderForUser({ id: registered.user.id, role: 'student' }))
      .send({
        title: 'City flat',
        description: 'desc',
        pricePerMonth: 900,
        totalRooms: 2,
        availableRooms: 1,
        type: 'flat',
        city: 'Cairo',
        amenities: {},
      });
    expect(created.status).toBe(201);
    expect(created.body).toHaveProperty('city', 'Cairo');

    const hit = await request(app)
      .get('/api/properties/search')
      .query({ city: 'cairo' })
      .set(authHeaderForUser({ id: registered.user.id, role: 'student' }));
    expect(hit.status).toBe(200);
    expect(hit.body.items.some((p) => p.id === created.body.id)).toBe(true);

    const miss = await request(app)
      .get('/api/properties/search')
      .query({ city: 'Alexandria' })
      .set(authHeaderForUser({ id: registered.user.id, role: 'student' }));
    expect(miss.status).toBe(200);
    expect(miss.body.items.some((p) => p.id === created.body.id)).toBe(false);
  });

  test('flatmate request stores phoneNumber and returns it on reads', async () => {
    const created = await request(app)
      .post('/api/flatmate-requests')
      .set(authHeaderForUser({ id: registered.user.id, role: 'student' }))
      .send({
        preferredBudget: 1500,
        preferredType: 'flat',
        phoneNumber: '+201099999999',
        peopleWanted: 1,
      });
    expect(created.status).toBe(201);
    expect(created.body).toHaveProperty('phoneNumber', '+201099999999');

    const detail = await request(app)
      .get(`/api/flatmate-requests/${created.body.id}`)
      .set(authHeaderForUser(admin));
    expect(detail.status).toBe(200);
    expect(detail.body).toHaveProperty('phoneNumber', '+201099999999');
  });
});
