const request = require('supertest');

const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User, UserActivity } = require('../../Models');

const { describe, beforeAll, afterAll, test, expect } = require('@jest/globals');

describe('Admin activities filters', () => {
  let app;
  let adminA;
  let adminB;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    adminA = await User.create({
      username: 'admin_filter_a',
      email: 'admin_filter_a@example.com',
      phone: '01000000901',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    adminB = await User.create({
      username: 'admin_filter_b',
      email: 'admin_filter_b@example.com',
      phone: '01000000902',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    await UserActivity.bulkCreate([
      {
        userId: adminA.id,
        activityType: 'dashboard_viewed',
        activityDetails: {
          entityType: 'dashboard',
          entityId: 'dash-1',
        },
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        userId: adminB.id,
        activityType: 'payment_received',
        activityDetails: {
          entityType: 'payment',
          entityId: 'pay-123',
        },
        timestamp: new Date('2026-03-01T00:00:00.000Z'),
      },
      {
        userId: adminB.id,
        activityType: 'application_approved',
        activityDetails: {
          entityType: 'application',
          entityId: 'app-123',
        },
        timestamp: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('filters activities by range, actor, activity type, and entity context', async () => {
    const res = await request(app)
      .get('/api/activities')
      .query({
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-03-31T23:59:59.999Z',
        activityType: 'payment_received',
        actorId: adminB.id,
        entityType: 'payment',
        entityId: 'pay-123',
        page: 1,
        limit: 20,
      })
      .set(authHeaderForUser(adminA));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    const [item] = res.body;
    expect(item.activityType).toBe('payment_received');
    expect(item.userId).toBe(adminB.id);
    expect(item.activityDetails).toEqual(
      expect.objectContaining({
        entityType: 'payment',
        entityId: 'pay-123',
      })
    );
    expect(item.User).toEqual(
      expect.objectContaining({
        email: 'admin_filter_b@example.com',
        role: 'admin',
      })
    );
  });

  test('returns 400 for invalid date filter', async () => {
    const res = await request(app)
      .get('/api/activities')
      .query({ from: 'not-a-date' })
      .set(authHeaderForUser(adminA));

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message', 'Invalid from date');
  });
});
