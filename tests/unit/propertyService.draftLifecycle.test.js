const { describe, beforeAll, afterAll, test, expect, jest: jestObject } = require('@jest/globals');

const { initTestDatabase, closeTestDatabase } = require('../helpers/db');
const { User, Property } = require('../../Models');
const PropertyService = require('../../Services/propertyService');

describe('PropertyService drafted lifecycle rules', () => {
  jestObject.setTimeout(30000);

  let landlord;
  let admin;

  beforeAll(async () => {
    await initTestDatabase();

    admin = await User.create({
      username: 'draft_admin',
      email: 'draft_admin@example.com',
      phone: '01010000031',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlord = await User.create({
      username: 'draft_landlord',
      email: 'draft_landlord@example.com',
      phone: '01010000032',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('submitDrafted transitions drafted to sent and re-activates property', async () => {
    const property = await Property.create({
      title: 'Draft to sent',
      description: 'desc',
      images: [],
      pricePerMonth: 650,
      totalRooms: 2,
      availableRooms: 1,
      type: 'flat',
      locationLat: 30.5,
      locationLong: 31.5,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      state: 'drafted',
      isActive: false,
    });

    const submitted = await PropertyService.submitDrafted(landlord, property.id);
    expect(submitted.state).toBe('sent');
    expect(submitted.isActive).toBe(true);
  });

  test('editing drafted property does not auto-submit', async () => {
    const property = await Property.create({
      title: 'Draft edit keep state',
      description: 'desc',
      images: [],
      pricePerMonth: 670,
      totalRooms: 2,
      availableRooms: 1,
      type: 'room',
      locationLat: 30.6,
      locationLong: 31.6,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      state: 'drafted',
      isActive: false,
    });

    const updated = await PropertyService.updateForOwnerOrAdmin(landlord, property.id, {
      title: 'Draft edited',
    });

    expect(updated.state).toBe('drafted');
  });

  test('landlord delete converts owned property to drafted, admin delete is permanent', async () => {
    const ownerProperty = await Property.create({
      title: 'Owner delete',
      description: 'desc',
      images: [],
      pricePerMonth: 680,
      totalRooms: 2,
      availableRooms: 1,
      type: 'room',
      locationLat: 30.7,
      locationLong: 31.7,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      state: 'approved',
      isActive: true,
    });

    const landlordDelete = await PropertyService.deleteWithRoleSemantics(landlord, ownerProperty.id);
    expect(landlordDelete.mode).toBe('drafted');

    const refreshed = await Property.findByPk(ownerProperty.id);
    expect(refreshed).not.toBeNull();
    expect(refreshed.state).toBe('drafted');

    const adminProperty = await Property.create({
      title: 'Admin permanent delete',
      description: 'desc',
      images: [],
      pricePerMonth: 690,
      totalRooms: 2,
      availableRooms: 1,
      type: 'flat',
      locationLat: 30.8,
      locationLong: 31.8,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      state: 'declined',
      isActive: true,
    });

    const adminDelete = await PropertyService.deleteWithRoleSemantics(admin, adminProperty.id);
    expect(adminDelete.mode).toBe('permanent');

    const deleted = await Property.findByPk(adminProperty.id);
    expect(deleted).toBeNull();
  });
});
