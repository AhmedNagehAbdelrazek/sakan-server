const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { User, UserPreference, Notification } = require('../../Models');

async function makeUser(prefix, role) {
  const rand = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return User.create({
    username: `${prefix}_${role}_${rand.slice(0, 4)}`,
    email: `${prefix}_${role}_${rand}@example.com`,
    phone: `01${rand.slice(0, 9)}`,
    password_hash: 'password',
    role,
    verified: true,
  });
}

describe('US6: admin broadcast notifications', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let manager;
  let optedIn1;
  let optedIn2;
  let optedOut;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    admin = await makeUser('us6', 'admin');
    manager = await makeUser('us6', 'manager');
    optedIn1 = await makeUser('us6', 'student');
    optedIn2 = await makeUser('us6', 'landlord');
    optedOut = await makeUser('us6', 'student');
    await UserPreference.create({ userId: optedOut.id, notification: false });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('broadcast delivers durable rows to every active opted-in user and skips opted-out', async () => {
    const emits = [];
    app.set('io', {
      to(room) {
        return {
          emit: (event, payload) => emits.push({ room, event, payload }),
        };
      },
    });

    const res = await request(app)
      .post('/api/admin/broadcast')
      .set(authHeaderForUser(admin))
      .send({ title: 'Server maintenance', body: 'The app will be down tonight.', type: 'broadcast' });

    expect(res.status).toBe(200);
    expect(res.body.delivered).toBe(4);

    for (const user of [admin, optedIn1, optedIn2]) {
      const count = await Notification.count({ where: { userId: user.id, notificationType: 'broadcast' } });
      expect(count).toBe(1);
    }

    const optedOutCount = await Notification.count({ where: { userId: optedOut.id, notificationType: 'broadcast' } });
    expect(optedOutCount).toBe(0);

    expect(emits).toHaveLength(4);
    expect(emits.some((e) => e.room === `notifications_${admin.id}`)).toBe(true);
    expect(emits.every((e) => e.event === 'notification')).toBe(true);
    expect(emits.every((e) => e.payload.content.title === 'Server maintenance')).toBe(true);

    app.set('io', null);
  });

  test('zero-audience broadcast succeeds', async () => {
    await User.update({ active: false }, { where: { id: [manager.id, optedIn1.id, optedIn2.id, optedOut.id] } });
    await UserPreference.create({ userId: admin.id, notification: false });

    const res = await request(app)
      .post('/api/admin/broadcast')
      .set(authHeaderForUser(admin))
      .send({ title: 'Hello' });

    expect(res.status).toBe(200);
    expect(res.body.delivered).toBe(0);

    await User.update({ active: true }, { where: { id: [manager.id, optedIn1.id, optedIn2.id, optedOut.id] } });
    await UserPreference.destroy({ where: { userId: admin.id, notification: false } });
  });

  test('manager is rejected from broadcasting', async () => {
    const res = await request(app)
      .post('/api/admin/broadcast')
      .set(authHeaderForUser(manager))
      .send({ title: 'Hi' });

    expect(res.status).toBe(403);
  });

  test('broadcast requires a title', async () => {
    const res = await request(app)
      .post('/api/admin/broadcast')
      .set(authHeaderForUser(admin))
      .send({ body: 'no title here' });

    expect(res.status).toBe(400);
  });
});
