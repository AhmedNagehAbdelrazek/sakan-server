const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US3: landlord list includes drafted properties', () => {
  jestObject.setTimeout(30000);

  let app;
  let landlord;
  let draftedProperty;
  let sentProperty;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ landlord } = await createLifecycleUsers('us3_list_drafted'));

    draftedProperty = await createPropertyForState({
      landlordId: landlord.id,
      state: 'drafted',
      isActive: false,
      overrides: { title: 'Drafted listed' },
    });

    sentProperty = await createPropertyForState({
      landlordId: landlord.id,
      state: 'sent',
      isActive: true,
      overrides: { title: 'Sent listed' },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('GET /api/properties as landlord includes drafted and sent own properties', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set(authHeaderForUser(landlord));

    expect(res.status).toBe(200);
    const ids = res.body.items.map((item) => item.id);

    expect(ids).toContain(draftedProperty.id);
    expect(ids).toContain(sentProperty.id);
  });
});
