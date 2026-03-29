const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User, Property } = require('../../Models');

const { describe, beforeAll, afterAll, test, expect } = require('@jest/globals');

describe('US4: landlord lists payments', () => {
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
      username: 'admin_us4_list',
      email: 'admin_us4_list@example.com',
      phone: '01000000081',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlord = await User.create({
      username: 'landlord_us4_list',
      email: 'landlord_us4_list@example.com',
      phone: '01000000082',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'student_us4_list',
      email: 'student_us4_list@example.com',
      phone: '01000000083',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    property = await Property.create({
      title: 'US4 list property',
      description: 'desc',
      pricePerMonth: 650,
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

  test('landlord can list payments for their properties', async () => {
    const created = await request(app)
      .post('/api/applications')
      .set(authHeaderForUser(student))
      .send({ propertyId: property.id, totalAmount: 650 });
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

    const list = await request(app)
      .get('/api/payments')
      .set(authHeaderForUser(landlord));

    expect(list.status).toBe(200);
    expect(list.body).toHaveProperty('items');
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.map((p) => p.id)).toContain(paymentId);
  });
});
