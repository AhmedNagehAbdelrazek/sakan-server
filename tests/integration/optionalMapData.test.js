const request = require('supertest');

const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');
const { createApp } = require('../../app');
const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { authHeaderForUser } = require('../helpers/auth');

const { User, FlatmateRequest } = require('../../Models');

describe('optional map data (no map integration yet)', () => {
  jestObject.setTimeout(30000);

  let app;
  let landlord;
  let student;
  let otherStudent;

  beforeAll(async () => {
    await initTestDatabase();
    app = createApp();

    landlord = await User.create({
      username: 'map_landlord',
      email: 'map_landlord@example.com',
      phone: '01000000061',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'map_student',
      email: 'map_student@example.com',
      phone: '01000000062',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    otherStudent = await User.create({
      username: 'map_other_student',
      email: 'map_other_student@example.com',
      phone: '01000000063',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('property can be created with no location data at all', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set(authHeaderForUser(landlord))
      .send({
        title: 'No map property',
        description: 'desc',
        pricePerMonth: 1000,
        totalRooms: 2,
        availableRooms: 1,
        type: 'flat',
        city: 'Cairo',
        amenities: {},
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('locationLat', null);
    expect(res.body).toHaveProperty('locationLong', null);
    expect(res.body).toHaveProperty('address', null);
  });

  test('property cannot be created with only one coordinate', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set(authHeaderForUser(landlord))
      .send({
        title: 'Half location',
        description: 'desc',
        pricePerMonth: 1000,
        totalRooms: 2,
        availableRooms: 1,
        type: 'flat',
        city: 'Cairo',
        locationLat: 30.1,
        amenities: {},
      });

    expect(res.status).toBe(400);
  });

  test('property request can be created with no location data at all', async () => {
    const res = await request(app)
      .post('/api/property-requests')
      .set(authHeaderForUser(student))
      .send({
        message: 'looking for a flat with no specific area',
        propertyType: 'flat',
        requestType: 'looking',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('locationLat', null);
    expect(res.body).toHaveProperty('locationLong', null);
    expect(res.body).toHaveProperty('address', null);
  });

  test('flatmate request can be created with no location data at all', async () => {
    const res = await request(app)
      .post('/api/flatmate-requests')
      .set(authHeaderForUser(student))
      .send({
        preferredBudget: 1200,
        preferredType: 'flat',
        phoneNumber: '+201001234567',
        message: 'looking for a flatmate, anywhere',
        peopleWanted: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('locationLat', null);
    expect(res.body).toHaveProperty('locationLong', null);
    expect(res.body).toHaveProperty('radiusKm', null);
  });

  test('matching without location matches other requests regardless of their location', async () => {
    const candidate = await request(app)
      .post('/api/flatmate-requests')
      .set(authHeaderForUser(otherStudent))
      .send({
        preferredBudget: 1300,
        preferredType: 'flat',
        phoneNumber: '+201001234568',
        message: 'candidate with coords',
        peopleWanted: 1,
        radiusKm: 10,
        locationLat: 30.05,
        locationLong: 31.24,
      });
    expect(candidate.status).toBe(201);

    const res = await request(app)
      .get('/api/flatmate-requests/matches')
      .set(authHeaderForUser(student))
      .send();

    expect(res.status).toBe(200);
    expect(res.body.items.some((r) => r.id === candidate.body.id)).toBe(true);
  });

  test('matching with a located base request excludes candidates without coordinates', async () => {
    const other = await User.create({
      username: 'map_other_student_2',
      email: 'map_other_student_2@example.com',
      phone: '01000000064',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    const locationlessCandidate = await FlatmateRequest.create({
      userId: other.id,
      preferredBudget: 1200,
      preferredType: 'room',
      phoneNumber: '+201001234569',
      peopleWanted: 1,
      radiusKm: null,
      locationLat: null,
      locationLong: null,
      isMatched: false,
    });

    const base = await FlatmateRequest.create({
      userId: student.id,
      preferredBudget: 1200,
      preferredType: 'room',
      phoneNumber: '+201001234570',
      peopleWanted: 1,
      radiusKm: 20,
      locationLat: 30.05,
      locationLong: 31.24,
      isMatched: false,
    });

    const res = await request(app)
      .get('/api/flatmate-requests/matches')
      .query({ requestId: base.id })
      .set(authHeaderForUser(student))
      .send();

    expect(res.status).toBe(200);
    expect(res.body.items.some((r) => r.id === locationlessCandidate.id)).toBe(false);
  });
});
