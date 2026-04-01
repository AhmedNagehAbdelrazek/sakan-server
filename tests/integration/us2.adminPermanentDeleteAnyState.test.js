const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');
const { Property } = require('../../Models');

describe('US2: admin permanent delete from any state', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let landlord;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ admin, landlord } = await createLifecycleUsers('us2_delete_any_state'));
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('admin can permanently delete drafted/sent/approved/declined', async () => {
    const states = ['drafted', 'sent', 'approved', 'declined'];

    for (const state of states) {
      const property = await createPropertyForState({
        landlordId: landlord.id,
        state,
        isActive: state !== 'drafted',
        overrides: { title: `Delete ${state}` },
      });

      const res = await request(app)
        .delete(`/api/properties/${property.id}`)
        .set(authHeaderForUser(admin));

      expect(res.status).toBe(200);
      expect(res.body.mode).toBe('permanent');

      const deleted = await Property.findByPk(property.id);
      expect(deleted).toBeNull();
    }
  });
});
