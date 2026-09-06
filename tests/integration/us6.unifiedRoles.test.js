const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User, Property } = require('../../Models');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');

describe('US6: unified roles for students and landlords', () => {
  jestObject.setTimeout(30000);

  let app;
  let landlordA;
  let landlordB;
  let student;
  let landlordBProperty;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    landlordA = await User.create({
      username: 'unified_landlord_a',
      email: 'unified_landlord_a@example.com',
      phone: '01000000051',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    landlordB = await User.create({
      username: 'unified_landlord_b',
      email: 'unified_landlord_b@example.com',
      phone: '01000000052',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'unified_student',
      email: 'unified_student@example.com',
      phone: '01000000053',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    landlordBProperty = await Property.create({
            city: 'Cairo',
      title: 'Unified property',
      description: 'desc',
      pricePerMonth: 900,
      totalRooms: 1,
      availableRooms: 1,
      type: 'room',
      locationLat: 30.1,
      locationLong: 31.2,
      address: 'SECRET',
      amenities: {},
      userId: landlordB.id,
      isActive: true,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('student can add a property', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set(authHeaderForUser(student))
      .send({
        title: 'Student added property',
        description: 'desc',
        pricePerMonth: 1000,
        totalRooms: 2,
        availableRooms: 1,
        type: 'flat',
        city: 'Cairo',
        locationLat: 30.1,
        locationLong: 31.2,
        address: 'SECRET',
        amenities: {},
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('userId', student.id);
    expect(res.body).toHaveProperty('state', 'sent');
  });

  test('landlord can create a flatmate request', async () => {
    const res = await request(app)
      .post('/api/flatmate-requests')
      .set(authHeaderForUser(landlordA))
      .send({
        preferredBudget: 1200,
        preferredType: 'flat',
        phoneNumber: '+201001234567',
        message: 'looking for a flatmate',
        peopleWanted: 1,
        radiusKm: 10,
        locationLat: 30.05,
        locationLong: 31.24,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('userId', landlordA.id);
  });

  test('landlord can apply to another user\'s property', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set(authHeaderForUser(landlordA))
      .send({
        propertyId: landlordBProperty.id,
        isForSharing: false,
        totalAmount: 900,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('userId', landlordA.id);
    expect(res.body).toHaveProperty('status', 'pending');
  });

  test('landlord lists applications they submitted and applications on their properties', async () => {
    const asApplicant = await request(app)
      .get('/api/applications')
      .set(authHeaderForUser(landlordA))
      .send();

    expect(asApplicant.status).toBe(200);
    expect(asApplicant.body.items.some((app) => app.user?.id === landlordA.id)).toBe(true);

    const asPropertyOwner = await request(app)
      .get('/api/applications')
      .set(authHeaderForUser(landlordB))
      .send();

    expect(asPropertyOwner.status).toBe(200);
    expect(asPropertyOwner.body.items.some((app) => app.property?.id === landlordBProperty.id)).toBe(true);
  });

  test('user cannot apply to their own property', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set(authHeaderForUser(landlordB))
      .send({
        propertyId: landlordBProperty.id,
        isForSharing: false,
        totalAmount: 900,
      });

    expect(res.status).toBe(400);
  });

  test('user cannot join their own flatmate request', async () => {
    const created = await request(app)
      .post('/api/flatmate-requests')
      .set(authHeaderForUser(landlordA))
      .send({
        preferredBudget: 1100,
        preferredType: 'room',
        phoneNumber: '+201001234567',
        message: 'own request',
        peopleWanted: 1,
        radiusKm: 5,
        locationLat: 30.05,
        locationLong: 31.24,
      });

    expect(created.status).toBe(201);

    const join = await request(app)
      .post(`/api/flatmate-requests/${created.body.id}/join-interest`)
      .set(authHeaderForUser(landlordA))
      .send({ message: 'joining my own request' });

    expect(join.status).toBe(400);
  });
});
