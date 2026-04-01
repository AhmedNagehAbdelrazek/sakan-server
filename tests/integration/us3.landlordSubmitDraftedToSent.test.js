const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US3: landlord submits drafted property to sent', () => {
  jestObject.setTimeout(30000);

  let app;
  let landlord;
  let property;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ landlord } = await createLifecycleUsers('us3_submit'));

    property = await createPropertyForState({
      landlordId: landlord.id,
      state: 'drafted',
      isActive: false,
      overrides: { title: 'Drafted to submit' },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('PATCH /api/properties/:id/submit transitions drafted -> sent', async () => {
    const res = await request(app)
      .patch(`/api/properties/${property.id}/submit`)
      .set(authHeaderForUser(landlord))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.property.state).toBe('sent');
    expect(res.body.property.isActive).toBe(true);
  });
});
