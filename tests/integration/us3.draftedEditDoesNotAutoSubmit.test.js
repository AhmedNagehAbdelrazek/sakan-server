const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US3: editing drafted property does not auto-submit', () => {
  jestObject.setTimeout(30000);

  let app;
  let landlord;
  let property;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ landlord } = await createLifecycleUsers('us3_edit_drafted'));

    property = await createPropertyForState({
      landlordId: landlord.id,
      state: 'drafted',
      isActive: false,
      overrides: { title: 'Draft before edit' },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('PATCH /api/properties/:id keeps drafted state', async () => {
    const res = await request(app)
      .patch(`/api/properties/${property.id}`)
      .set(authHeaderForUser(landlord))
      .send({ title: 'Draft after edit' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('drafted');
  });
});
