const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User, Property } = require('../../Models');

const { describe, beforeAll, afterAll, test, expect } = require('@jest/globals');

describe('US3: initiate payment without method', () => {
  jest.setTimeout(30000);

  let app;
  let admin;
  let landlord;
  let student;
  let property;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    admin = await User.create({
      username: 'admin_us3',
      email: 'admin_us3@example.com',
      phone: '01000000041',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlord = await User.create({
      username: 'landlord_us3',
      email: 'landlord_us3@example.com',
      phone: '01000000042',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'student_us3',
      email: 'student_us3@example.com',
      phone: '01000000043',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    property = await Property.create({
      title: 'US3 property',
      description: 'desc',
      pricePerMonth: 800,
      totalRooms: 1,
      availableRooms: 1,
      type: 'room',
      locationLat: 30.1,
      locationLong: 31.2,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      isActive: true,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('student can initiate payment without providing a method', async () => {
    const created = await request(app)
      .post('/api/applications')
      .set(authHeaderForUser(student))
      .send({
        propertyId: property.id,
        isForSharing: false,
        totalAmount: 800,
      });

    expect(created.status).toBe(201);

    const approve = await request(app)
      .patch(`/api/applications/${created.body.id}/approve`)
      .set(authHeaderForUser(admin))
      .send({});

    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('approved');

    const pay = await request(app)
      .patch(`/api/applications/${created.body.id}/pay`)
      .set(authHeaderForUser(student))
      .send({});

    expect(pay.status).toBe(200);
    expect(pay.body).toHaveProperty('payment');
    expect(pay.body.payment).toHaveProperty('method', null);
    expect(pay.body.payment).toHaveProperty('currency', 'EGP');
    expect(pay.body.payment).toHaveProperty('status', 'pending');
  });
});
