const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User } = require('../../Models');
const PropertyService = require('../../Services/propertyService');

const { describe, beforeAll, afterAll, test, expect } = require('@jest/globals');

describe('US1: student browsing properties', () => {
  jest.setTimeout(30000);

  let app;
  let landlord;
  let student;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    landlord = await User.create({
      username: 'landlord1',
      email: 'landlord1@example.com',
      phone: '01000000001',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'student1',
      email: 'student1@example.com',
      phone: '01000000002',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    const created = await PropertyService.createForLandlord(landlord.id, {
      title: 'Nice flat',
      description: 'Close to campus',
      pricePerMonth: 1000,
      totalRooms: 2,
      availableRooms: 1,
      type: 'flat',
      locationLat: 30.0444,
      locationLong: 31.2357,
      address: 'SECRET ADDRESS',
      amenities: {},
    });

    await created.update({ state: 'approved' });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('student can list active, unblocked properties without address', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set(authHeaderForUser(student));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);

    const item = res.body.items[0];
    expect(item).toHaveProperty('address', null);
    expect(item).toHaveProperty('isActive', true);
    expect(item).toHaveProperty('availableRooms');
    expect(Number(item.availableRooms)).toBeGreaterThan(0);
  });
});
