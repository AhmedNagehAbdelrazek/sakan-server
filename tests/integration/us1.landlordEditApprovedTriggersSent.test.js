const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US1: landlord editing approved property re-enters review', () => {
  jestObject.setTimeout(30000);

  let app;
  let landlord;
  let property;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ landlord } = await createLifecycleUsers('us1_edit_approved'));

    property = await createPropertyForState({
      landlordId: landlord.id,
      state: 'approved',
      isActive: true,
      overrides: { title: 'Approved before edit' },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('PATCH /api/properties/:id transitions approved -> sent for landlord edits', async () => {
    const res = await request(app)
      .patch(`/api/properties/${property.id}`)
      .set(authHeaderForUser(landlord))
      .send({ title: 'Approved after edit' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('state', 'sent');
  });
});
