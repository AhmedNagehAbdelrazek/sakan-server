const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User, Property, Application } = require('../../Models');

const { describe, beforeAll, afterAll, test, expect } = require('@jest/globals');

describe('US2: approval decrements capacity safely', () => {
  jest.setTimeout(30000);

  let app;
  let admin;
  let landlord;
  let studentA;
  let studentB;
  let property;
  let applicationA;
  let applicationB;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    admin = await User.create({
      username: 'admin_us2',
      email: 'admin_us2@example.com',
      phone: '01000000031',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlord = await User.create({
      username: 'landlord_us2_2',
      email: 'landlord_us2_2@example.com',
      phone: '01000000032',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    studentA = await User.create({
      username: 'student_us2_a',
      email: 'student_us2_a@example.com',
      phone: '01000000033',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    studentB = await User.create({
      username: 'student_us2_b',
      email: 'student_us2_b@example.com',
      phone: '01000000034',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    property = await Property.create({
      title: 'US2 last room',
      description: 'desc',
      pricePerMonth: 500,
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

    applicationA = await Application.create({
      userId: studentA.id,
      propertyId: property.id,
      isForSharing: false,
      totalAmount: 500,
      status: 'pending',
    });

    applicationB = await Application.create({
      userId: studentB.id,
      propertyId: property.id,
      isForSharing: false,
      totalAmount: 500,
      status: 'pending',
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('only one of two concurrent approvals for last room succeeds', async () => {
    const results = await Promise.allSettled([
      request(app)
        .patch(`/api/applications/${applicationA.id}/approve`)
        .set(authHeaderForUser(admin))
        .send({}),
      request(app)
        .patch(`/api/applications/${applicationB.id}/approve`)
        .set(authHeaderForUser(admin))
        .send({}),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200);
    const failures = results.filter((r) => r.status === 'fulfilled' && r.value.status !== 200);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const refreshed = await Property.findByPk(property.id);
    expect(Number(refreshed.availableRooms)).toBe(0);
  });
});
