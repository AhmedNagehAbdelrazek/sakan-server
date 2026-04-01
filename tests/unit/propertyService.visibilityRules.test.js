const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');

const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { User, Property } = require('../../Models');
const PropertyService = require('../../Services/propertyService');

describe('PropertyService visibility rules', () => {
  jestObject.setTimeout(30000);

  let admin;
  let landlordA;
  let landlordB;
  let student;

  beforeAll(async () => {
    await initTestDatabase();

    admin = await User.create({
      username: 'visibility_admin',
      email: 'visibility_admin@example.com',
      phone: '01010000011',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlordA = await User.create({
      username: 'visibility_landlord_a',
      email: 'visibility_landlord_a@example.com',
      phone: '01010000012',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    landlordB = await User.create({
      username: 'visibility_landlord_b',
      email: 'visibility_landlord_b@example.com',
      phone: '01010000013',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'visibility_student',
      email: 'visibility_student@example.com',
      phone: '01010000014',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });

    await Property.bulkCreate([
      {
        title: 'Approved visible',
        description: 'desc',
        images: [],
        pricePerMonth: 500,
        totalRooms: 2,
        availableRooms: 1,
        type: 'flat',
        locationLat: 30.01,
        locationLong: 31.01,
        address: 'SECRET A',
        amenities: {},
        userId: landlordA.id,
        state: 'approved',
        isActive: true,
      },
      {
        title: 'Sent hidden from student',
        description: 'desc',
        images: [],
        pricePerMonth: 700,
        totalRooms: 2,
        availableRooms: 1,
        type: 'flat',
        locationLat: 30.02,
        locationLong: 31.02,
        address: 'SECRET B',
        amenities: {},
        userId: landlordA.id,
        state: 'sent',
        isActive: true,
      },
      {
        title: 'Drafted for landlord B',
        description: 'desc',
        images: [],
        pricePerMonth: 800,
        totalRooms: 2,
        availableRooms: 1,
        type: 'room',
        locationLat: 30.03,
        locationLong: 31.03,
        address: 'SECRET C',
        amenities: {},
        userId: landlordB.id,
        state: 'drafted',
        isActive: false,
      },
    ]);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('student sees only approved and masked properties', async () => {
    const result = await PropertyService.listForStudent(student, { page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].state).toBe('approved');
    expect(result.items[0].address).toBeNull();
  });

  test('landlord sees all own states including drafted when querying own properties', async () => {
    const result = await PropertyService.listForUser(landlordB, { page: 1, limit: 20 });

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items.some((item) => item.state === 'drafted')).toBe(true);
  });

  test('admin can list properties across all states', async () => {
    const result = await PropertyService.listForUser(admin, { page: 1, limit: 50 });

    const states = new Set(result.items.map((item) => item.state));
    expect(states.has('approved')).toBe(true);
    expect(states.has('sent')).toBe(true);
    expect(states.has('drafted')).toBe(true);
  });
});
