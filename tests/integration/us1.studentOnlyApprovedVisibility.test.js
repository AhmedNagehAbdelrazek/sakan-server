const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US1: student sees only approved properties', () => {
  jestObject.setTimeout(30000);

  let app;
  let landlord;
  let student;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ landlord, student } = await createLifecycleUsers('us1_student_visibility'));

    await createPropertyForState({
      landlordId: landlord.id,
      state: 'approved',
      isActive: true,
      overrides: { title: 'Approved visible' },
    });

    await createPropertyForState({
      landlordId: landlord.id,
      state: 'sent',
      isActive: true,
      overrides: { title: 'Sent hidden from student' },
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('GET /api/properties for student includes only approved', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set(authHeaderForUser(student));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].state).toBe('approved');
    expect(res.body.items[0].address).toBeNull();
  });
});
