const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User, Property } = require('../../Models');

const { describe, beforeAll, afterAll, test, expect } = require('@jest/globals');

describe('US5: admin completes application', () => {
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
      username: 'admin_us5_complete',
      email: 'admin_us5_complete@example.com',
      phone: '01000000111',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlord = await User.create({
      username: 'landlord_us5_complete',
      email: 'landlord_us5_complete@example.com',
      phone: '01000000112',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'student_us5_complete',
      email: 'student_us5_complete@example.com',
      phone: '01000000113',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    property = await Property.create({
      title: 'US5 complete property',
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

  test('admin can complete a checked-in application and set completedAt', async () => {
    const created = await request(app)
      .post('/api/applications')
      .set(authHeaderForUser(student))
      .send({ propertyId: property.id, totalAmount: 800 });
    expect(created.status).toBe(201);

    const approve = await request(app)
      .patch(`/api/applications/${created.body.id}/approve`)
      .set(authHeaderForUser(admin))
      .send({});
    expect(approve.status).toBe(200);

    const pay = await request(app)
      .patch(`/api/applications/${created.body.id}/pay`)
      .set(authHeaderForUser(student))
      .send({});
    expect(pay.status).toBe(200);

    const paymentId = pay.body.payment.id;

    const receive = await request(app)
      .patch(`/api/payments/${paymentId}/receive`)
      .set(authHeaderForUser(admin))
      .send({});
    expect(receive.status).toBe(200);

    const checkin = await request(app)
      .patch(`/api/applications/${created.body.id}/checkin`)
      .set(authHeaderForUser(student))
      .send({});
    expect(checkin.status).toBe(200);

    const complete = await request(app)
      .patch(`/api/applications/${created.body.id}/complete`)
      .set(authHeaderForUser(admin))
      .send({});

    expect(complete.status).toBe(200);
    expect(complete.body).toHaveProperty('status', 'completed');
    expect(complete.body).toHaveProperty('completedAt');
    expect(complete.body.completedAt).toBeTruthy();
  });
});
