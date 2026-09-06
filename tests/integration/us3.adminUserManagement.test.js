const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');
const { User, UserProfile, UserPreference } = require('../../Models');

async function makeUser(prefix, role, extra = {}) {
  const rand = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return User.create({
    username: `${prefix}_${role}_${rand.slice(0, 4)}`,
    email: `${prefix}_${role}_${rand}@example.com`,
    phone: `01${String(Math.floor(Math.random() * 10))}${rand.slice(0, 8)}`.slice(0, 11),
    password_hash: 'password',
    role,
    verified: true,
    ...extra,
  });
}

describe('US3: admin user management', () => {
  jestObject.setTimeout(30000);

  let app;
  let admin;
  let manager;
  let superAdmin;
  let student;
  let targetUser;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    admin = await makeUser('us3', 'admin');
    manager = await makeUser('us3', 'manager');
    superAdmin = await makeUser('us3', 'super_admin');
    student = await makeUser('us3', 'student');

    targetUser = await makeUser('us3', 'student', { active: true });
    await UserProfile.create({ userId: targetUser.id, firstName: 'Sara', lastName: 'Ali', university: 'Cairo U' });
    await UserPreference.create({ userId: targetUser.id, notification: true, theme: 'dark' });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('list supports pagination, search, and filters', async () => {
    const res = await request(app)
      .get(`/api/user?role=student&search=${targetUser.username}&limit=1&page=1`)
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(targetUser.id);
    expect(res.body.items[0]).toHaveProperty('active');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(1);
  });

  test('list filters by verified and active flags', async () => {
    const res = await request(app)
      .get('/api/user?active=false&verified=true')
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(res.body.items.every((u) => u.active === false)).toBe(true);
  });

  test('single-user view includes profile and preferences', async () => {
    const res = await request(app)
      .get(`/api/user/${targetUser.id}`)
      .set(authHeaderForUser(admin));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(targetUser.id);
    expect(res.body.profile.firstName).toBe('Sara');
    expect(res.body.preferences.theme).toBe('dark');
  });

  test('role change takes effect', async () => {
    const res = await request(app)
      .patch(`/api/user/${student.id}`)
      .set(authHeaderForUser(admin))
      .send({ role: 'landlord' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('landlord');

    await User.update({ role: 'student' }, { where: { id: student.id } });
  });

  test('deactivated user is blocked from sign-in and protected routes', async () => {
    const victim = await makeUser('us3', 'student', { verified: true, active: true });

    const deactivate = await request(app)
      .patch(`/api/user/${victim.id}`)
      .set(authHeaderForUser(admin))
      .send({ active: false });
    expect(deactivate.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: victim.email, password: 'password' });
    expect(login.status).toBe(401);

    const me = await request(app)
      .get('/api/user/me')
      .set(authHeaderForUser(victim));
    expect(me.status).toBe(401);
  });

  test('admin cannot deactivate their own account', async () => {
    const res = await request(app)
      .patch(`/api/user/${admin.id}`)
      .set(authHeaderForUser(admin))
      .send({ active: false });

    expect(res.status).toBe(400);
  });

  test('last super admin cannot be demoted', async () => {
    const res = await request(app)
      .patch(`/api/user/${superAdmin.id}`)
      .set(authHeaderForUser(superAdmin))
      .send({ role: 'manager' });

    expect(res.status).toBe(400);
  });

  test('manager can read the user list but cannot mutate', async () => {
    const read = await request(app)
      .get('/api/user?limit=5')
      .set(authHeaderForUser(manager));
    expect(read.status).toBe(200);

    const mutate = await request(app)
      .patch(`/api/user/${targetUser.id}`)
      .set(authHeaderForUser(manager))
      .send({ role: 'landlord' });
    expect(mutate.status).toBe(403);
  });

  test('student cannot access the user directory', async () => {
    const res = await request(app)
      .get('/api/user')
      .set(authHeaderForUser(student));

    expect(res.status).toBe(403);
  });
});
