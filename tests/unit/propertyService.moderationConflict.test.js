const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');

const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { User, Property } = require('../../Models');
const PropertyService = require('../../Services/propertyService');

describe('PropertyService moderation conflict behavior', () => {
  jestObject.setTimeout(30000);

  let landlord;

  beforeAll(async () => {
    await initTestDatabase();

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
            city: 'Cairo',
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
      PropertyService.approveSent(property.id),
      PropertyService.declineSent(property.id),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.statusCode).toBe(409);
  });

  test('reopen from declined transitions to sent', async () => {
    const property = await Property.create({
            city: 'Cairo',
      title: 'Reopen transition',
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

    const reopened = await PropertyService.reopenDeclined(property.id);
    expect(reopened.state).toBe('sent');
  });
});
