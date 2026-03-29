const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User, Property } = require('../../Models');

const { describe, beforeAll, afterAll, test, expect } = require('@jest/globals');

describe('US4: admin marks payment received', () => {
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
      username: 'admin_us4_r',
      email: 'admin_us4_r@example.com',
      phone: '01000000061',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlord = await User.create({
      username: 'landlord_us4_r',
      email: 'landlord_us4_r@example.com',
      phone: '01000000062',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'student_us4_r',
      email: 'student_us4_r@example.com',
      phone: '01000000063',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    property = await Property.create({
      title: 'US4 property',
      description: 'desc',
      pricePerMonth: 700,
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

  test('admin can mark a pending payment as received and transition application to paid', async () => {
    const created = await request(app)
      .post('/api/applications')
      .set(authHeaderForUser(student))
      .send({ propertyId: property.id, totalAmount: 700 });
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
    expect(receive.body).toHaveProperty('status', 'received');
    expect(receive.body).toHaveProperty('receivedAt');
    expect(receive.body).toHaveProperty('receivedBy', admin.id);

    const detail = await request(app)
      .get(`/api/applications/${created.body.id}`)
      .set(authHeaderForUser(student));

    expect(detail.status).toBe(200);
    expect(detail.body).toHaveProperty('status', 'paid');
    expect(detail.body).toHaveProperty('paidAt');
  });
});
