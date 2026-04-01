const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US2: concurrent moderation conflict handling', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let landlord;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ admin, landlord } = await createLifecycleUsers('us2_conflict'));
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('stale second moderation action returns 409', async () => {
    const property = await createPropertyForState({
      landlordId: landlord.id,
      state: 'sent',
      isActive: true,
      overrides: { title: 'Concurrent moderation target' },
    });

    const [a, b] = await Promise.all([
      request(app)
        .patch(`/api/properties/${property.id}/approve`)
        .set(authHeaderForUser(admin))
        .send({}),
      request(app)
        .patch(`/api/properties/${property.id}/decline`)
        .set(authHeaderForUser(admin))
        .send({}),
    ]);

    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([200, 409]);
  });
});
