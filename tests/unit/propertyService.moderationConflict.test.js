const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');

const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { User, Property } = require('../../Models');
const PropertyService = require('../../Services/propertyService');

describe('PropertyService moderation conflict behavior', () => {
  jestObject.setTimeout(30000);

  let admin;
  let landlord;

  beforeAll(async () => {
    await initTestDatabase();

    admin = await User.create({
      username: 'moderation_admin',
      email: 'moderation_admin@example.com',
      phone: '01010000021',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlord = await User.create({
      username: 'moderation_landlord',
      email: 'moderation_landlord@example.com',
      phone: '01010000022',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('concurrent approve/decline on sent property yields one conflict', async () => {
    const property = await Property.create({
      title: 'Concurrent moderation',
      description: 'desc',
      images: [],
      pricePerMonth: 750,
      totalRooms: 2,
      availableRooms: 2,
      type: 'flat',
      locationLat: 30.3,
      locationLong: 31.3,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      state: 'sent',
      isActive: true,
    });

    const results = await Promise.allSettled([
      PropertyService.approveSent(admin, property.id),
      PropertyService.declineSent(admin, property.id),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.statusCode).toBe(409);
  });

  test('reopen from declined is admin-only', async () => {
    const property = await Property.create({
      title: 'Reopen authorization',
      description: 'desc',
      images: [],
      pricePerMonth: 770,
      totalRooms: 2,
      availableRooms: 2,
      type: 'flat',
      locationLat: 30.4,
      locationLong: 31.4,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      state: 'declined',
      isActive: true,
    });

    await expect(PropertyService.reopenDeclined(landlord, property.id)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
