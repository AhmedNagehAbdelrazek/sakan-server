const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers } = require('../helpers/propertyStateFixtures');

describe('US1: landlord create property defaults to sent', () => {
  jestObject.setTimeout(30000);

  let app;
  let landlord;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ landlord } = await createLifecycleUsers('us1_create'));
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('POST /api/properties persists state=sent', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set(authHeaderForUser(landlord))
      .send({
        title: 'US1 sent default',
        description: 'desc',
        pricePerMonth: 1000,
        totalRooms: 2,
        availableRooms: 1,
        type: 'flat',
        locationLat: 30.1,
        locationLong: 31.2,
        address: 'SECRET',
        amenities: { wifi: true },
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('state', 'sent');
  });
});
