const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');
const { Property } = require('../../Models');

describe('US3: landlord delete moves property to drafted', () => {
  jestObject.setTimeout(30000);

  let app;
  let landlord;
  let property;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ landlord } = await createLifecycleUsers('us3_delete_to_draft'));

    property = await createPropertyForState({
      landlordId: landlord.id,
      state: 'approved',
      isActive: true,
      overrides: { title: 'To drafted via delete' },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('DELETE /api/properties/:id as landlord returns drafted mode and keeps record', async () => {
    const res = await request(app)
      .delete(`/api/properties/${property.id}`)
      .set(authHeaderForUser(landlord));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mode', 'drafted');
    expect(res.body).toHaveProperty('state', 'drafted');

    const refreshed = await Property.findByPk(property.id);
    expect(refreshed).not.toBeNull();
    expect(refreshed.state).toBe('drafted');
    expect(refreshed.isActive).toBe(false);
  });
});
