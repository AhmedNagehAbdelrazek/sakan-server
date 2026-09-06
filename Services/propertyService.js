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

// Owner contact details are private: public (non-owner) views get a safe subset.
const SAFE_OWNER_FIELDS = ['id', 'username', 'role'];

function safeOwner(userJson) {
  if (!userJson) return null;
  const safe = {};
  for (const key of SAFE_OWNER_FIELDS) safe[key] = userJson[key];
  return safe;
}

function maskForNonOwner(propertyInstance) {
  const data = propertyInstance.toJSON ? propertyInstance.toJSON() : { ...propertyInstance };
  data.address = null;
  delete data.userId;
  if (data.owner) data.owner = safeOwner(data.owner);
  return data;
}

function fullSerialize(propertyInstance) {
  const data = propertyInstance.toJSON ? propertyInstance.toJSON() : { ...propertyInstance };
  delete data.userId;
  return data;
}

function normalizedState(propertyInstance) {
  return propertyInstance.state || 'approved';
}

function assertOwner(ownerUser, property) {
  if (property.userId !== ownerUser.id) {
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
      city,
      amenities,
      images,
    } = payload;

    if (!propertyTypes.includes(type)) throw new ApiError('Invalid property type', 400);
    if (typeof title !== 'string' || !title.trim()) throw new ApiError('title is required', 400);
    if (typeof description !== 'string' || !description.trim()) throw new ApiError('description is required', 400);
    if (typeof city !== 'string' || !city.trim()) throw new ApiError('city is required', 400);

    const price = Number(pricePerMonth);
    const total = Number(totalRooms);
    const avail = Number(availableRooms);
    assertNumeric(price, 'pricePerMonth');
    assertNumeric(total, 'totalRooms');
    assertNumeric(avail, 'availableRooms');
    if (total < 1) throw new ApiError('totalRooms must be >= 1', 400);
    if (avail < 0 || avail > total) throw new ApiError('availableRooms must be between 0 and totalRooms', 400);

    const hasLat = locationLat !== undefined && locationLat !== null && locationLat !== '';
    const hasLng = locationLong !== undefined && locationLong !== null && locationLong !== '';
    const hasAddress = address !== undefined && address !== null && address !== '';

    let lat = null;
    let lng = null;
    if (hasLat || hasLng) {
      if (hasLat !== hasLng) {
        throw new ApiError('Both locationLat and locationLong must be provided together', 400);
      }
      lat = Number(locationLat);
      lng = Number(locationLong);
      validateLatLng(lat, lng);
    }

    const record = await Property.create({
      title: title.trim(),
      description: description.trim(),
      pricePerMonth: price,
      totalRooms: total,
      availableRooms: avail,
      type,
      locationLat: lat,
      locationLong: lng,
      address: hasAddress ? address : null,
      city: city.trim(),
      amenities: sanitizeAmenities(amenities),
      images: sanitizeImages(images),
      userId: landlordId,
      isActive: true,
      state: 'sent',
    });

    return record;
  }

  static async listForUser(user, { page = 1, limit = 20, isActive } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const where = {};

    if (typeof isActive !== 'undefined') {
      where.isActive = !!isActive;
    }

    if (user.role === 'admin' || user.role === 'super_admin') {
      // admins see all states and all owners
    } else if (user.role === 'student' || user.role === 'landlord') {
      where.userId = user.id;
    }

    const offset = (p - 1) * l;
    const { rows, count } = await Property.findAndCountAll({
      where,
      include: [{ model: User, as: 'owner' }],
      order: [['createdat', 'DESC']],
      limit: l,
      offset,
    });

    const items = rows.map((row) => {
      if (!row.state) row.setDataValue('state', 'approved');
      return fullSerialize(row);
    });

    const totalPages = Math.ceil(count / l);

    return { items, page: p, limit: l, total: count, totalPages };
  }

  static async listForRegularUser(user, { page = 1, limit = 20 } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));

    const offset = (p - 1) * l;
    const { rows, count } = await Property.findAndCountAll({
      where: {
        [Op.or]: [
          { userId: user.id },
          {
            isActive: true,
            state: 'approved',
            availableRooms: { [Op.gt]: 0 },
          },
        ],
      },
      include: [{ model: User, as: 'owner' }],
      order: [['createdat', 'DESC']],
      limit: l,
      offset,
    });

    const items = rows.map((row) => {
      if (!row.state) row.setDataValue('state', 'approved');
      return row.userId === user.id ? fullSerialize(row) : maskForNonOwner(row);
    });
    const totalPages = Math.ceil(count / l);

    return { items, page: p, limit: l, total: count, totalPages };
  }

  static async search(user, filters = {}) {
    const {
      page = 1,
      limit = 20,
      q,
      city,
      type,
      minPrice,
      maxPrice,
      minRooms,
      maxRooms,
      state,
      isActive,
      latitude,
      longitude,
      radiusKm,
    } = filters;

    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const where = {};
    const andClauses = [];

    if (q) {
      andClauses.push({
        [Op.or]: [
          { title: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    if (city) {
      andClauses.push({ city: { [Op.iLike]: `%${city.trim()}%` } });
    }

    if (type) {
      andClauses.push({ type });
    }

    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter[Op.gte] = Number(minPrice);
      if (maxPrice) priceFilter[Op.lte] = Number(maxPrice);
      andClauses.push({ pricePerMonth: priceFilter });
    }

    if (minRooms || maxRooms) {
      const roomsFilter = {};
      if (minRooms) roomsFilter[Op.gte] = Number(minRooms);
      if (maxRooms) roomsFilter[Op.lte] = Number(maxRooms);
      andClauses.push({ totalRooms: roomsFilter });
    }

    if (user.role === 'student' || user.role === 'landlord') {
      andClauses.push({
        [Op.or]: [
          { userId: user.id },
          { isActive: true, state: 'approved', availableRooms: { [Op.gt]: 0 } },
        ],
      });
    }

    if (state && (user.role === 'admin' || user.role === 'super_admin')) {
      andClauses.push({ state });
    }
    if (typeof isActive !== 'undefined' && (user.role === 'admin' || user.role === 'super_admin')) {
      andClauses.push({ isActive: isActive === 'true' || isActive === true });
    }

    const lat = latitude != null ? Number(latitude) : null;
    const lng = longitude != null ? Number(longitude) : null;
    const radius = radiusKm != null ? Number(radiusKm) : null;

    if (lat != null && lng != null && radius != null) {
      assertNumeric(lat, 'latitude');
      assertNumeric(lng, 'longitude');
      assertNumeric(radius, 'radiusKm');

      const latDelta = radius / 111;
      const lngDelta = radius / (111 * Math.cos((Math.PI * lat) / 180) || 1e-6);

      const minLat = lat - latDelta;
      const maxLat = lat + latDelta;
      const minLng = lng - lngDelta;
      const maxLng = lng + lngDelta;

      const locationIds = await sequelize.query(
        `SELECT id FROM "properties"
         WHERE "location_lat" BETWEEN :minLat AND :maxLat
           AND "location_long" BETWEEN :minLng AND :maxLng
           AND (
             6371 * acos(
               cos(pi() * :lat / 180) * cos(pi() * "location_lat" / 180) *
               cos(pi() * "location_long" / 180 - pi() * :lng / 180) +
               sin(pi() * :lat / 180) * sin(pi() * "location_lat" / 180)
             )
           ) <= :radiusKm`,
        {
          type: QueryTypes.SELECT,
          replacements: { lat, lng, radiusKm: radius, minLat, maxLat, minLng, maxLng },
        }
      );

      const ids = locationIds.map((r) => r.id);
      if (ids.length === 0) {
        const totalPages = 0;
        return { items: [], page: p, limit: l, total: 0, totalPages };
      }
      andClauses.push({ id: { [Op.in]: ids } });
    }

    if (andClauses.length > 0) {
      where[Op.and] = andClauses;
    }

    const offset = (p - 1) * l;
    const { rows, count } = await Property.findAndCountAll({
      where,
      include: [{ model: User, as: 'owner' }],
      order: [['createdat', 'DESC']],
      limit: l,
      offset,
    });

    const totalPages = Math.ceil(count / l);

    let items;
    if (user.role === 'admin' || user.role === 'super_admin') {
      items = rows.map((row) => fullSerialize(row));
    } else {
      items = rows.map((row) => (row.userId === user.id ? fullSerialize(row) : maskForNonOwner(row)));
    }

    return { items, page: p, limit: l, total: count, totalPages };
  }

  static async getByIdForViewer(user, id) {
    const prop = await Property.findByPk(id, { include: [{ model: User, as: 'owner' }] });
    if (!prop) throw new ApiError('Property not found', 404);

    const state = normalizedState(prop);

    if (user.role === 'admin' || user.role === 'super_admin') {
      if (!prop.state) prop.setDataValue('state', state);
      return fullSerialize(prop);
    }

    if ((user.role === 'student' || user.role === 'landlord') && prop.userId === user.id) {
      if (!prop.state) prop.setDataValue('state', state);
      return fullSerialize(prop);
    }

    if (!prop.isActive || state !== 'approved') {
      throw new ApiError('Property not found', 404);
    }

    return maskForNonOwner(prop);
  }

  static async updateForOwnerOrAdmin(user, id, updates) {
    const prop = await Property.findByPk(id);
    if (!prop) throw new ApiError('Property not found', 404);

    const isOwner = (user.role === 'student' || user.role === 'landlord') && prop.userId === user.id;
    const isAdmin = (user.role === 'admin' || user.role === 'super_admin');
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
    if (updates.locationLat !== undefined || updates.locationLong !== undefined) {
      const latValue = updates.locationLat !== undefined ? updates.locationLat : prop.locationLat;
      const lngValue = updates.locationLong !== undefined ? updates.locationLong : prop.locationLong;

      if (latValue == null && lngValue == null) {
        payload.locationLat = null;
        payload.locationLong = null;
      } else if (latValue == null || lngValue == null) {
        throw new ApiError('Both locationLat and locationLong must be provided together', 400);
      } else {
        const lat = Number(latValue);
        const lng = Number(lngValue);
        validateLatLng(lat, lng);
        payload.locationLat = lat;
        payload.locationLong = lng;
      }
    }
    if (updates.address !== undefined) {
      payload.address = typeof updates.address === 'string' ? updates.address : null;
    }
    if (updates.city != null) {
      if (typeof updates.city !== 'string' || !updates.city.trim()) throw new ApiError('Invalid city', 400);
      payload.city = updates.city.trim();
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

  static async approveSent(id) {
    return this.transitionWithExpectedState({
      id,
      expectedState: propertyStateTransitions.approveSent.from,
      nextState: propertyStateTransitions.approveSent.to,
      updates: { isActive: true },
    });
  }

  static async declineSent(id) {
    return this.transitionWithExpectedState({
      id,
      expectedState: propertyStateTransitions.declineSent.from,
      nextState: propertyStateTransitions.declineSent.to,
      updates: { isActive: true },
    });
  }

  static async reopenDeclined(id) {
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

    if (user.role === 'admin' || user.role === 'super_admin') {
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

  static async nearbyCount({ lat, lng, radiusKm = 5 }, user = null, { page = 1, limit = 20 } = {}) {
    const radius = Number(radiusKm);
    assertNumeric(lat, 'lat');
    assertNumeric(lng, 'long');
    assertNumeric(radius, 'radiusKm');

    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));

    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.cos((Math.PI * lat) / 180) || 1e-6);

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    const countSql = `
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

    const itemsSql = `
      SELECT *
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
      ORDER BY "created_at" DESC
      LIMIT :limit OFFSET :offset
    `;

    const replacements = { lat, lng, radiusKm: radius, minLat, maxLat, minLng, maxLng, limit: l, offset: (p - 1) * l };

    const [[countRow], rows] = await Promise.all([
      sequelize.query(countSql, { type: QueryTypes.SELECT, replacements }),
      sequelize.query(itemsSql, { type: QueryTypes.SELECT, replacements }),
    ]);

    const count = countRow?.count || 0;
    const totalPages = Math.ceil(count / l);

    // Attach the related owner object to the raw SQL rows.
    const ownerIds = [...new Set(rows.map((r) => r.user_id))];
    const owners = await User.findAll({ where: { id: { [Op.in]: ownerIds } } });
    const ownerMap = new Map(owners.map((o) => [o.id, o.toJSON()]));
    const isRegular = user && (user.role === 'student' || user.role === 'landlord');

    let items = rows.map((row) => {
      const isOwn = isRegular && row.user_id === user.id;
      const data = { ...row };
      data.owner = ownerMap.get(data.user_id) || null;
      delete data.user_id;
      if (isRegular && !isOwn) {
        data.address = null;
        data.owner = safeOwner(data.owner);
      }
      return data;
    });

    return { items, count, page: p, limit: l, totalPages };
  }
}

module.exports = PropertyService;
