const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US2: admin moderates sent properties', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let landlord;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ admin, landlord } = await createLifecycleUsers('us2_moderation'));
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('PATCH /approve transitions sent -> approved', async () => {
    const property = await createPropertyForState({
      landlordId: landlord.id,
      state: 'sent',
      isActive: true,
      overrides: { title: 'Sent to approve' },
    });

    const res = await request(app)
      .patch(`/api/properties/${property.id}/approve`)
      .set(authHeaderForUser(admin))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.property.state).toBe('approved');
  });

  test('PATCH /decline transitions sent -> declined', async () => {
    const property = await createPropertyForState({
      landlordId: landlord.id,
      state: 'sent',
      isActive: true,
      overrides: { title: 'Sent to decline' },
    });

    const res = await request(app)
      .patch(`/api/properties/${property.id}/decline`)
      .set(authHeaderForUser(admin))
      .send({ reason: 'Incomplete details' });

    expect(res.status).toBe(200);
    expect(res.body.property.state).toBe('declined');
  });
});
