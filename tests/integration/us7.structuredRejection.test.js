const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { Application } = require('../../Models');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

async function makePendingApplication(prefix) {
  const { admin, landlord, student } = await createLifecycleUsers(prefix);
  const property = await createPropertyForState({ landlordId: landlord.id, state: 'approved', isActive: true });
  const app = await Application.create({
    userId: student.id,
    propertyId: property.id,
    status: 'pending',
    totalAmount: 1000,
  });
  return { admin, landlord, student, property, app };
}

describe('US7: structured application rejection reasons', () => {
  jestObject.setTimeout(30000);

  let app;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('rejecting with a valid category and detail stores both and is visible to the applicant', async () => {
    const { admin, student, app: application } = await makePendingApplication('us7_happy');

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set(authHeaderForUser(admin))
      .send({ reasonCategory: 'documents_missing', detail: 'The ID photo is unreadable' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.rejectionReason).toBe('documents_missing');
    expect(res.body.message).toContain('ID photo is unreadable');

    const view = await request(app)
      .get(`/api/applications/${application.id}`)
      .set(authHeaderForUser(student));

    expect(view.status).toBe(200);
    expect(view.body.status).toBe('rejected');
    expect(view.body.rejectionReason).toBe('documents_missing');
    expect(view.body.message).toContain('ID photo is unreadable');
  });

  test('missing reasonCategory returns 400', async () => {
    const { admin, app: application } = await makePendingApplication('us7_no_category');

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set(authHeaderForUser(admin))
      .send({ detail: 'just a note' });

    expect(res.status).toBe(400);
  });

  test('invalid reasonCategory returns 400', async () => {
    const { admin, app: application } = await makePendingApplication('us7_bad_category');

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set(authHeaderForUser(admin))
      .send({ reasonCategory: 'because_i_said_so' });

    expect(res.status).toBe(400);
  });

  test('non-pending applications cannot be rejected', async () => {
    const { admin, landlord, student, property } = await createLifecycleUsers('us7_not_pending');
    const prop = await createPropertyForState({ landlordId: landlord.id, state: 'approved', isActive: true });
    const application = await Application.create({
      userId: student.id,
      propertyId: prop.id,
      status: 'approved',
      totalAmount: 1000,
    });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set(authHeaderForUser(admin))
      .send({ reasonCategory: 'not_available' });

    expect(res.status).toBe(400);
  });

  test('manager is rejected from rejecting applications', async () => {
    const { landlord, student, app: application } = await makePendingApplication('us7_manager');
    const manager = await require('../../Models').User.create({
      username: 'us7_manager_mgr',
      email: 'us7_manager_mgr@example.com',
      phone: '01412345678',
      password_hash: 'password',
      role: 'manager',
      verified: true,
    });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set(authHeaderForUser(manager))
      .send({ reasonCategory: 'not_available' });

    expect(res.status).toBe(403);
  });
});
