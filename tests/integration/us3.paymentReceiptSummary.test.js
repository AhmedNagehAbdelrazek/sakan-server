const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User, Property, Payment, Application } = require('../../Models');

const { describe, beforeAll, afterAll, test, expect } = require('@jest/globals');

describe('US3: receipt summary on application detail', () => {
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
      username: 'admin_us3_2',
      email: 'admin_us3_2@example.com',
      phone: '01000000051',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlord = await User.create({
      username: 'landlord_us3_2',
      email: 'landlord_us3_2@example.com',
      phone: '01000000052',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'student_us3_2',
      email: 'student_us3_2@example.com',
      phone: '01000000053',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    property = await Property.create({
      title: 'US3 receipt property',
      description: 'desc',
      pricePerMonth: 900,
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

  test('GET /applications/:id includes a receipt summary once payment is received', async () => {
    const created = await request(app)
      .post('/api/applications')
      .set(authHeaderForUser(student))
      .send({
        propertyId: property.id,
        isForSharing: false,
        totalAmount: 900,
      });

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

    // Simulate receipt confirmation (US4 will add endpoints; here we update directly).
    await Payment.update(
      {
        status: 'received',
        receivedAt: new Date(),
        receivedBy: admin.id,
      },
      { where: { id: paymentId } }
    );
    await Application.update(
      {
        status: 'paid',
        paidAt: new Date(),
      },
      { where: { id: created.body.id } }
    );

    const detail = await request(app)
      .get(`/api/applications/${created.body.id}`)
      .set(authHeaderForUser(student));

    expect(detail.status).toBe(200);
    expect(detail.body).toHaveProperty('receipt');

    // Receipt summary is intentionally small and stable.
    expect(detail.body.receipt).toEqual(
      expect.objectContaining({
        paymentId,
        amount: '900.00',
        currency: 'EGP',
        status: 'received',
      })
    );
  });
});
