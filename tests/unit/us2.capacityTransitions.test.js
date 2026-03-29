const { initTestDatabase, closeTestDatabase } = require('../helpers/db');

const { User, Property, Application } = require('../../Models');
const ApplicationService = require('../../Services/applicationService');

const { describe, beforeAll, afterAll, test, expect } = require('@jest/globals');

describe('US2: capacity transitions', () => {
  jest.setTimeout(30000);

  let admin;
  let landlord;
  let student;

  beforeAll(async () => {
    await initTestDatabase();

    admin = await User.create({
      username: 'admin1',
      email: 'admin1@example.com',
      phone: '01000000021',
      password_hash: 'password',
      role: 'admin',
      verified: true,
    });

    landlord = await User.create({
      username: 'landlord_us2',
      email: 'landlord_us2@example.com',
      phone: '01000000022',
      password_hash: 'password',
      role: 'landlord',
      verified: true,
    });

    student = await User.create({
      username: 'student_us2',
      email: 'student_us2@example.com',
      phone: '01000000023',
      password_hash: 'password',
      role: 'student',
      verified: true,
    });
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  test('approve decrements availableRooms and sets approval timestamps', async () => {
    const property = await Property.create({
      title: 'US2 property',
      description: 'desc',
      pricePerMonth: 1000,
      totalRooms: 1,
      availableRooms: 1,
      type: 'room',
      locationLat: 30.1,
      locationLong: 31.2,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      isActive: true,
    });

    const app = await Application.create({
      userId: student.id,
      propertyId: property.id,
      isForSharing: false,
      totalAmount: 1000,
      status: 'pending',
    });

    const approved = await ApplicationService.approve(admin, app.id);

    const refreshedProperty = await Property.findByPk(property.id);
    expect(Number(refreshedProperty.availableRooms)).toBe(0);

    expect(approved.status).toBe('approved');
    expect(approved.approvedAt).toBeTruthy();
    expect(approved.approvalExpiresAt).toBeTruthy();
  });

  test('expired approval is rejected and capacity restored on read', async () => {
    const property = await Property.create({
      title: 'US2 property expiry',
      description: 'desc',
      pricePerMonth: 1000,
      totalRooms: 1,
      availableRooms: 1,
      type: 'room',
      locationLat: 30.1,
      locationLong: 31.2,
      address: 'SECRET',
      amenities: {},
      userId: landlord.id,
      isActive: true,
    });

    const app = await Application.create({
      userId: student.id,
      propertyId: property.id,
      isForSharing: false,
      totalAmount: 1000,
      status: 'pending',
    });

    const approved = await ApplicationService.approve(admin, app.id);

    // Simulate expiry
    await approved.update({ approvalExpiresAt: new Date(Date.now() - 60_000) });

    const afterRead = await ApplicationService.getById(student, approved.id);
    expect(afterRead.status).toBe('rejected');

    const refreshedProperty = await Property.findByPk(property.id);
    expect(Number(refreshedProperty.availableRooms)).toBe(1);
  });
});
