const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US2: only admin can reopen declined properties', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let landlord;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ admin, landlord } = await createLifecycleUsers('us2_reopen'));
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('admin can reopen declined -> sent', async () => {
    const property = await createPropertyForState({
      landlordId: landlord.id,
      state: 'declined',
      isActive: true,
      overrides: { title: 'Declined to reopen' },
    });

    const res = await request(app)
      .patch(`/api/properties/${property.id}/reopen`)
      .set(authHeaderForUser(admin))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.property.state).toBe('sent');
  });

  test('landlord cannot reopen declined property', async () => {
    const property = await createPropertyForState({
      landlordId: landlord.id,
      state: 'declined',
      isActive: true,
      overrides: { title: 'Declined forbidden reopen' },
    });

    const res = await request(app)
      .patch(`/api/properties/${property.id}/reopen`)
      .set(authHeaderForUser(landlord))
      .send({});

    expect(res.status).toBe(403);
  });
});
