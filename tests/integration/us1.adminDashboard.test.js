const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { User, Property, Application, Payment, PropertyRequest } = require('../../Models');
const { createLifecycleUsers, createPropertyForState } = require('../helpers/propertyStateFixtures');

describe('US1: admin dashboard with live operational metrics', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let landlord;
  let student;
  let manager;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    ({ admin, landlord, student } = await createLifecycleUsers('us1_dashboard'));
    manager = await User.create({
      username: 'us1_dashboard_manager',
      email: 'us1_dashboard_manager@example.com',
      phone: '01312345678',
      password_hash: 'password',
      role: 'manager',
      verified: true,
    });

    await createPropertyForState({ landlordId: landlord.id, state: 'approved', isActive: true, overrides: { title: 'Approved listing' } });
    await createPropertyForState({ landlordId: landlord.id, state: 'sent', isActive: true, overrides: { title: 'Needs moderation' } });

    const application = await Application.create({
      userId: student.id,
      propertyId: (await Property.findOne({ where: { state: 'approved' } })).id,
      status: 'pending',
      totalAmount: 1000,
    });

    await Payment.create({
      applicationId: application.id,
      studentId: student.id,
      landlordId: landlord.id,
      amount: 1000,
      status: 'received',
      currency: 'EGP',
    });

    await PropertyRequest.create({
      userId: student.id,
      message: 'looking for a flat',
      propertyType: 'flat',
      requestType: 'looking',
      status: 'pending',
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('GET /api/admin/dashboard returns live metrics matching seeded data', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    const { metrics, needsAttention } = res.body;

    expect(metrics.users.totalUsersCount).toBeGreaterThanOrEqual(4);
    expect(metrics.users.newUsersCount).toBeGreaterThanOrEqual(4);
    expect(metrics.properties.activeListingsCount).toBe(1);
    expect(metrics.properties.newListingsCount).toBe(2);

    expect(metrics.applications.byStatus.pending).toBe(1);
    expect(metrics.payments.byStatus.received).toBe(1);
    expect(metrics.payments.byStatus.refunded).toBe(0);

    expect(needsAttention.applications.some((a) => a.status === 'pending')).toBe(true);
    expect(needsAttention.payments.some((p) => p.status === 'received')).toBe(true);
    expect(needsAttention.propertyRequests.some((r) => r.status === 'pending')).toBe(true);
    expect(needsAttention.properties.some((p) => p.state === 'sent')).toBe(true);
  });

  test('GET /api/admin/dashboard respects a date range and returns zero-filled trends', async () => {
    const from = new Date(Date.now() + 1000).toISOString();
    const to = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .get(`/api/admin/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(res.body.metrics.users.newUsersCount).toBe(0);
    expect(res.body.trends.users.length).toBe(3);
    expect(res.body.trends.users.every((d) => d.count === 0)).toBe(true);
  });

  test('GET /api/admin/dashboard allows manager (read-only) access', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set(authHeaderForUser(manager));

    expect(res.status).toBe(200);
  });

  test('GET /api/admin/dashboard rejects a student', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set(authHeaderForUser(student));

    expect(res.status).toBe(403);
  });

  test('GET /api/admin/dashboard returns 400 for invalid date range', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard?from=not-a-date')
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(400);
  });
});
