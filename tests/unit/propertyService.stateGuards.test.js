const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');

const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { User, Property } = require('../../Models');
const PropertyService = require('../../Services/propertyService');

describe('PropertyService transition guards', () => {
  jestObject.setTimeout(30000);

  let landlord;

  beforeAll(async () => {
    await initTestDatabase();

    landlord = await User.create({
      username: 'guard_landlord',
      email: 'guard_landlord@example.com',
      phone: '01010000001',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('transitionWithExpectedState updates when expected state matches', async () => {
    const property = await Property.create({
      title: 'Guard property success',
      description: 'desc',
      images: [],
      pricePerMonth: 900,
      totalRooms: 2,
      availableRooms: 2,
      type: 'flat',
      locationLat: 30.1,
      locationLong: 31.2,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      state: 'sent',
      isActive: true,
    });

    const updated = await PropertyService.transitionWithExpectedState({
      id: property.id,
      expectedState: 'sent',
      nextState: 'approved',
    });

    expect(updated.state).toBe('approved');
  });

  test('transitionWithExpectedState throws conflict when state changed', async () => {
    const property = await Property.create({
      title: 'Guard property conflict',
      description: 'desc',
      images: [],
      pricePerMonth: 900,
      totalRooms: 2,
      availableRooms: 2,
      type: 'flat',
      locationLat: 30.1,
      locationLong: 31.2,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      state: 'declined',
      isActive: true,
    });

    await expect(
      PropertyService.transitionWithExpectedState({
        id: property.id,
        expectedState: 'sent',
        nextState: 'approved',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('transitionWithExpectedState throws not found for missing property', async () => {
    await expect(
      PropertyService.transitionWithExpectedState({
        id: '11111111-1111-1111-1111-111111111111',
        expectedState: 'sent',
        nextState: 'approved',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
