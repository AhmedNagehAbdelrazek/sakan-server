// /Services/propertyService.js
const { QueryTypes, Op } = require('sequelize');
const sequelize = require('../config/database');
const { Property, User } = require('../Models');
const ApiError = require('../utils/ApiError');
const { propertyTypes, propertyStateTransitions } = require('../config/constants');

function assertNumeric(n, name) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new ApiError(`${name} must be a finite number`, 400);
  }
}

function validateLatLng(lat, lng) {
  assertNumeric(lat, 'locationLat');
  assertNumeric(lng, 'locationLong');
  if (lat < -90 || lat > 90) throw new ApiError('locationLat out of range', 400);
  if (lng < -180 || lng > 180) throw new ApiError('locationLong out of range', 400);
}

function sanitizeAmenities(amenities) {
  if (amenities == null) return {};
  if (typeof amenities !== 'object' || Array.isArray(amenities)) {
    throw new ApiError('amenities must be an object', 400);
  }
  return amenities;
}

function sanitizeImages(images) {
  if (images == null) return [];
  if (!Array.isArray(images)) {
    throw new ApiError('images must be an array of image URLs', 400);
  }

  return images.map((image, index) => {
    if (typeof image !== 'string' || !image.trim()) {
      throw new ApiError(`images[${index}] must be a non-empty string URL`, 400);
    }
    return image.trim();
  });
}

function maskForNonOwner(propertyInstance) {
  const data = propertyInstance.toJSON();
  data.address = null;
  return data;
}

function normalizedState(propertyInstance) {
  return propertyInstance.state || 'approved';
}

function assertRole(user, role) {
  if (!user || user.role !== role) {
    throw new ApiError('Forbidden', 403);
  }
}

function assertOwner(landlordUser, property) {
  if (landlordUser.role !== 'landlord' || property.userId !== landlordUser.id) {
    throw new ApiError('Forbidden', 403);
  }
}

function throwConflict(expectedState, actualState) {
  throw new ApiError(
    `Stale transition. Expected property state '${expectedState}' but found '${actualState}'.`,
    409,
  );
}

function hasUpdatableFields(payload) {
  return Object.keys(payload).length > 0;
}

class PropertyService {
  static async createForLandlord(landlordId, payload) {
    const landlord = await User.findByPk(landlordId);
    if (!landlord || landlord.role !== 'landlord') {
      throw new ApiError('Only landlords can create properties', 403);
    }

    const {
      title,
      description,
      pricePerMonth,
      totalRooms,
      availableRooms,
      type,
      locationLat,
      locationLong,
      address,
      amenities,
      images,
    } = payload;

    if (!propertyTypes.includes(type)) throw new ApiError('Invalid property type', 400);
    if (typeof title !== 'string' || !title.trim()) throw new ApiError('title is required', 400);
    if (typeof description !== 'string' || !description.trim()) throw new ApiError('description is required', 400);

    const price = Number(pricePerMonth);
    const total = Number(totalRooms);
    const avail = Number(availableRooms);
    assertNumeric(price, 'pricePerMonth');
    assertNumeric(total, 'totalRooms');
    assertNumeric(avail, 'availableRooms');
    if (total < 1) throw new ApiError('totalRooms must be >= 1', 400);
    if (avail < 0 || avail > total) throw new ApiError('availableRooms must be between 0 and totalRooms', 400);

    const lat = Number(locationLat);
    const lng = Number(locationLong);
    validateLatLng(lat, lng);

    const record = await Property.create({
      title: title.trim(),
      description: description.trim(),
      pricePerMonth: price,
      totalRooms: total,
      availableRooms: avail,
      type,
      locationLat: lat,
      locationLong: lng,
      address: typeof address === 'string' ? address : null,
      amenities: sanitizeAmenities(amenities),
      images: sanitizeImages(images),
      userId: landlordId,
      isActive: true,
      state: 'sent',
    });

    return record;
  }

  static async listForUser(user, { page = 1, limit = 20, isActive } = {}) {
    const p = Number(page);
    const l = Number(limit);
    const where = {};

    if (typeof isActive !== 'undefined') {
      where.isActive = !!isActive;
    }

    if (user.role === 'admin') {
      // admins see all states and all owners
    } else if (user.role === 'landlord') {
      where.userId = user.id;
    } else {
      throw new ApiError('Forbidden', 403);
    }

    const offset = (p - 1) * l;
    const { rows, count } = await Property.findAndCountAll({
      where,
      order: [['createdat', 'DESC']],
      limit: l,
      offset,
    });

    const items = rows.map((row) => {
      if (!row.state) row.setDataValue('state', 'approved');
      return row;
    });

    return { items, page: p, limit: l, total: count };
  }

  static async listForStudent(user, { page = 1, limit = 20 } = {}) {
    const p = Number(page);
    const l = Number(limit);

    if (user.role !== 'student') {
      throw new ApiError('Forbidden', 403);
    }

    const offset = (p - 1) * l;
    const { rows, count } = await Property.findAndCountAll({
      where: {
        isActive: true,
        state: 'approved',
        availableRooms: { [Op.gt]: 0 },
      },
      order: [['createdat', 'DESC']],
      limit: l,
      offset,
    });

    const masked = rows.map(maskForNonOwner);
    return { items: masked, page: p, limit: l, total: count };
  }

  static async getByIdForViewer(user, id) {
    const prop = await Property.findByPk(id);
    if (!prop) throw new ApiError('Property not found', 404);

    const state = normalizedState(prop);

    if (user.role === 'admin') {
      if (!prop.state) prop.setDataValue('state', state);
      return prop;
    }

    if (user.role === 'landlord' && prop.userId === user.id) {
      if (!prop.state) prop.setDataValue('state', state);
      return prop;
    }

    if (!prop.isActive || state !== 'approved') {
      throw new ApiError('Property not found', 404);
    }

    return maskForNonOwner(prop);
  }

  static async updateForOwnerOrAdmin(user, id, updates) {
    const prop = await Property.findByPk(id);
    if (!prop) throw new ApiError('Property not found', 404);

    const isOwner = user.role === 'landlord' && prop.userId === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) throw new ApiError('Forbidden', 403);

    if (updates.state !== undefined) {
      throw new ApiError('state is managed by workflow and cannot be set directly', 400);
    }

    const payload = {};

    if (updates.title != null) {
      if (typeof updates.title !== 'string' || !updates.title.trim()) throw new ApiError('Invalid title', 400);
      payload.title = updates.title.trim();
    }
    if (updates.description != null) {
      if (typeof updates.description !== 'string' || !updates.description.trim()) throw new ApiError('Invalid description', 400);
      payload.description = updates.description.trim();
    }
    if (updates.pricePerMonth != null) {
      const price = Number(updates.pricePerMonth);
      assertNumeric(price, 'pricePerMonth');
      payload.pricePerMonth = price;
    }
    if (updates.totalRooms != null) {
      const total = Number(updates.totalRooms);
      assertNumeric(total, 'totalRooms');
      if (total < 1) throw new ApiError('totalRooms must be >= 1', 400);
      payload.totalRooms = total;
    }
    if (updates.availableRooms != null) {
      const avail = Number(updates.availableRooms);
      assertNumeric(avail, 'availableRooms');
      payload.availableRooms = avail;
    }

    const finalTotal = payload.totalRooms != null ? payload.totalRooms : Number(prop.totalRooms);
    const finalAvail = payload.availableRooms != null ? payload.availableRooms : Number(prop.availableRooms);
    if (finalAvail < 0 || finalAvail > finalTotal) {
      throw new ApiError('availableRooms must be between 0 and totalRooms', 400);
    }

    if (updates.type != null) {
      if (!propertyTypes.includes(updates.type)) throw new ApiError('Invalid property type', 400);
      payload.type = updates.type;
    }
    if (updates.locationLat != null || updates.locationLong != null) {
      const lat = updates.locationLat != null ? Number(updates.locationLat) : Number(prop.locationLat);
      const lng = updates.locationLong != null ? Number(updates.locationLong) : Number(prop.locationLong);
      validateLatLng(lat, lng);
      payload.locationLat = lat;
      payload.locationLong = lng;
    }
    if (updates.address !== undefined) {
      payload.address = typeof updates.address === 'string' ? updates.address : null;
    }
    if (updates.amenities !== undefined) {
      payload.amenities = sanitizeAmenities(updates.amenities);
    }
    if (updates.images !== undefined) {
      payload.images = sanitizeImages(updates.images);
    }
    if (updates.isActive !== undefined) {
      payload.isActive = !!updates.isActive;
    }

    const currentState = normalizedState(prop);

    if (isOwner && hasUpdatableFields(payload) && currentState === propertyStateTransitions.approveSent.to) {
      payload.state = propertyStateTransitions.submitDrafted.to;
      payload.isActive = true;
    }

    if (!prop.state) {
      prop.setDataValue('state', currentState);
      if (!payload.state) {
        payload.state = currentState;
      }
    }

    await prop.update(payload);
    return prop;
  }

  static async transitionWithExpectedState({ id, expectedState, nextState, updates = {} }) {
    const [affectedCount, rows] = await Property.update(
      { state: nextState, ...updates },
      {
        where: { id, state: expectedState },
        returning: true,
      },
    );

    if (affectedCount > 0) {
      return rows[0];
    }

    const current = await Property.findByPk(id);
    if (!current) {
      throw new ApiError('Property not found', 404);
    }

    throwConflict(expectedState, normalizedState(current));
  }

  static async submitDrafted(user, id) {
    assertRole(user, 'landlord');

    const property = await Property.findByPk(id);
    if (!property) throw new ApiError('Property not found', 404);
    assertOwner(user, property);

    const state = normalizedState(property);
    if (state !== propertyStateTransitions.submitDrafted.from) {
      throw new ApiError('Only drafted properties can be submitted for review', 400);
    }

    return this.transitionWithExpectedState({
      id,
      expectedState: propertyStateTransitions.submitDrafted.from,
      nextState: propertyStateTransitions.submitDrafted.to,
      updates: { isActive: true },
    });
  }

  static async approveSent(user, id) {
    assertRole(user, 'admin');

    return this.transitionWithExpectedState({
      id,
      expectedState: propertyStateTransitions.approveSent.from,
      nextState: propertyStateTransitions.approveSent.to,
      updates: { isActive: true },
    });
  }

  static async declineSent(user, id) {
    assertRole(user, 'admin');

    return this.transitionWithExpectedState({
      id,
      expectedState: propertyStateTransitions.declineSent.from,
      nextState: propertyStateTransitions.declineSent.to,
      updates: { isActive: true },
    });
  }

  static async reopenDeclined(user, id) {
    assertRole(user, 'admin');

    return this.transitionWithExpectedState({
      id,
      expectedState: propertyStateTransitions.reopenDeclined.from,
      nextState: propertyStateTransitions.reopenDeclined.to,
      updates: { isActive: true },
    });
  }

  static async deleteWithRoleSemantics(user, id) {
    const prop = await Property.findByPk(id);
    if (!prop) throw new ApiError('Property not found', 404);

    if (user.role === 'admin') {
      await prop.destroy();
      return { deleted: true, mode: 'permanent' };
    }

    assertOwner(user, prop);

    await prop.update({
      state: 'drafted',
      isActive: false,
    });

    return {
      deleted: true,
      mode: 'drafted',
      state: 'drafted',
    };
  }

  static async softDelete(user, id) {
    return this.deleteWithRoleSemantics(user, id);
  }

  static async nearbyCount({ lat, lng, radiusKm = 5 }) {
    const radius = Number(radiusKm);
    assertNumeric(lat, 'lat');
    assertNumeric(lng, 'long');
    assertNumeric(radius, 'radiusKm');

    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.cos((Math.PI * lat) / 180) || 1e-6);

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    const sql = `
      SELECT COUNT(*)::int AS count
      FROM "properties"
      WHERE "is_active" = true
        AND "state" = 'approved'
        AND "location_lat" BETWEEN :minLat AND :maxLat
        AND "location_long" BETWEEN :minLng AND :maxLng
        AND (
          6371 * acos(
            cos(pi() * :lat / 180) * cos(pi() * "location_lat" / 180) *
            cos(pi() * "location_long" / 180 - pi() * :lng / 180) +
            sin(pi() * :lat / 180) * sin(pi() * "location_lat" / 180)
          )
        ) <= :radiusKm
    `;

    const [row] = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements: { lat, lng, radiusKm: radius, minLat, maxLat, minLng, maxLng },
    });

    return { count: row?.count || 0 };
  }
}

module.exports = PropertyService;
