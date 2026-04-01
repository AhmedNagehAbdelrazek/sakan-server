const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US1: admin review scope includes sent properties', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let landlord;
  let sentProperty;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ admin, landlord } = await createLifecycleUsers('us1_admin_review'));

    sentProperty = await createPropertyForState({
      landlordId: landlord.id,
      state: 'sent',
      isActive: true,
      overrides: { title: 'Sent for admin review' },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('GET /api/properties as admin includes sent property', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    const matched = res.body.items.find((item) => item.id === sentProperty.id);
    expect(matched).toBeTruthy();
    expect(matched.state).toBe('sent');
  });
});
