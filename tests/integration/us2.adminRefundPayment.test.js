const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { User, Property, Application, Payment } = require('../../Models');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

async function setupPaidApplication({ prefix, overrides = {} }) {
  const { admin, landlord, student } = await createLifecycleUsers(prefix);
  const property = await createPropertyForState({
    landlordId: landlord.id,
    state: 'approved',
    isActive: true,
    overrides: { totalRooms: 3, availableRooms: 2 },
  });
  const application = await Application.create({
    userId: student.id,
    propertyId: property.id,
    status: 'paid',
    totalAmount: 1000,
    ...overrides,
  });
  const payment = await Payment.create({
    applicationId: application.id,
    studentId: student.id,
    landlordId: landlord.id,
    amount: 1000,
    status: 'received',
    currency: 'EGP',
  });
  return { admin, landlord, student, property, application, payment };
}

describe('US2: admin-initiated payment refunds', () => {
  jestObject.setTimeout(30000);

  let app;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('refunding a received payment records actor/time/reason and closes out the application', async () => {
    const { admin, payment, application, property } = await setupPaidApplication({ prefix: 'us2_refund' });

    const res = await request(app)
      .patch(`/api/payments/${payment.id}/refund`)
      .set(authHeaderForUser(admin))
      .send({ reason: 'Student cancelled before release' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('refunded');
    expect(res.body.refundedBy).toBe(admin.id);
    expect(res.body.refundReason).toBe('Student cancelled before release');
    expect(res.body.refundedAt).toBeTruthy();

    const appAfter = await Application.findByPk(application.id);
    expect(appAfter.status).toBe('refunded');

    const propAfter = await Property.findByPk(property.id);
    expect(Number(propAfter.availableRooms)).toBe(3);

    const notifCount = await require('../../Models').Notification.count({ where: { userId: [payment.studentId, payment.landlordId] } });
    expect(notifCount).toBeGreaterThanOrEqual(2);
  });

  test('a refunded payment cannot be refunded again', async () => {
    const { admin, payment } = await setupPaidApplication({ prefix: 'us2_double_refund' });
    await request(app).patch(`/api/payments/${payment.id}/refund`).set(authHeaderForUser(admin)).send({ reason: 'first' });

    const res = await request(app).patch(`/api/payments/${payment.id}/refund`).set(authHeaderForUser(admin)).send({ reason: 'second' });
    expect(res.status).toBe(400);
  });

  test('a refunded payment cannot be released', async () => {
    const { admin, payment } = await setupPaidApplication({ prefix: 'us2_release_after_refund' });
    await request(app).patch(`/api/payments/${payment.id}/refund`).set(authHeaderForUser(admin)).send({ reason: 'test' });

    const res = await request(app).patch(`/api/payments/${payment.id}/release`).set(authHeaderForUser(admin));
    expect(res.status).toBe(400);
  });

  test('released payments cannot be refunded', async () => {
    const { admin, landlord, student, application } = await setupPaidApplication({ prefix: 'us2_released_refund' });
    const payment = await Payment.create({
      applicationId: application.id,
      studentId: student.id,
      landlordId: landlord.id,
      amount: 1000,
      status: 'released',
      currency: 'EGP',
    });

    const res = await request(app).patch(`/api/payments/${payment.id}/refund`).set(authHeaderForUser(admin)).send({ reason: 'late' });
    expect(res.status).toBe(400);
  });

  test('pending payments cannot be refunded', async () => {
    const { admin, landlord, student, application } = await setupPaidApplication({ prefix: 'us2_pending_refund' });
    const payment = await Payment.create({
      applicationId: application.id,
      studentId: student.id,
      landlordId: landlord.id,
      amount: 1000,
      status: 'pending',
      currency: 'EGP',
    });

    const res = await request(app).patch(`/api/payments/${payment.id}/refund`).set(authHeaderForUser(admin)).send({ reason: 'test' });
    expect(res.status).toBe(400);
  });

  test('refunds are rejected for a completed application', async () => {
    const { admin, payment } = await setupPaidApplication({ prefix: 'us2_completed_app' });
    await Application.update({ status: 'completed' }, { where: { id: payment.applicationId } });

    const res = await request(app).patch(`/api/payments/${payment.id}/refund`).set(authHeaderForUser(admin)).send({ reason: 'test' });
    expect(res.status).toBe(400);
  });

  test('manager is rejected from refunding', async () => {
    const { payment } = await setupPaidApplication({ prefix: 'us2_manager_refund' });
    const manager = await User.create({
      username: 'us2_manager_refund_mgr',
      email: 'us2_manager_refund_mgr@example.com',
      phone: '01412345678',
      password_hash: 'password',
      role: 'manager',
      verified: true,
    });

    const res = await request(app).patch(`/api/payments/${payment.id}/refund`).set(authHeaderForUser(manager)).send({ reason: 'test' });
    expect(res.status).toBe(403);
  });

  test('student is rejected from refunding', async () => {
    const { payment, student } = await setupPaidApplication({ prefix: 'us2_student_refund' });

    const res = await request(app).patch(`/api/payments/${payment.id}/refund`).set(authHeaderForUser(student)).send({ reason: 'test' });
    expect(res.status).toBe(403);
  });

  test('refund requires a reason', async () => {
    const { admin, payment } = await setupPaidApplication({ prefix: 'us2_no_reason' });

    const res = await request(app).patch(`/api/payments/${payment.id}/refund`).set(authHeaderForUser(admin)).send({});
    expect(res.status).toBe(400);
  });
});
