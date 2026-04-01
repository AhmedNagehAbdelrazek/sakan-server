const { User, Property } = require('../../Models');

async function createLifecycleUsers(prefix = 'lifecycle') {
  const admin = await User.create({
    username: `${prefix}_admin`,
    email: `${prefix}_admin@example.com`,
    phone: `010${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    password_hash: 'password',
    role: 'admin',
    verified: true,
  });

  const landlord = await User.create({
    username: `${prefix}_landlord`,
    email: `${prefix}_landlord@example.com`,
    phone: `011${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    password_hash: 'password',
    role: 'landlord',
    verified: true,
  });

  const student = await User.create({
    username: `${prefix}_student`,
    email: `${prefix}_student@example.com`,
    phone: `012${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    password_hash: 'password',
    role: 'student',
    verified: true,
  });

  return { admin, landlord, student };
}

async function createPropertyForState({ landlordId, state = 'sent', isActive = true, overrides = {} }) {
  return Property.create({
    title: 'Lifecycle property',
    description: 'Lifecycle property description',
    images: [],
    pricePerMonth: 1200,
    totalRooms: 3,
    availableRooms: 2,
    type: 'flat',
    locationLat: 30.0444,
    locationLong: 31.2357,
    address: 'Hidden address',
    amenities: {},
    userId: landlordId,
    isActive,
    state,
    ...overrides,
  });
}

module.exports = {
  createLifecycleUsers,
  createPropertyForState,
};
