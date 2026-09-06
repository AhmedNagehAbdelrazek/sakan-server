const { PropertyRequest, User } = require('../Models');
const ApiError = require('../utils/ApiError');
const { propertyTypes, requestTypes, requestStatusTransitions } = require('../config/constants');
const notify = require('./notificationService');

class PropertyRequestService {
  static async create(user, payload) {
    const { message, propertyType, requestType,phone, locationLat, locationLong, address, major } = payload;

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new ApiError('message is required', 400);
    }
    if (!propertyTypes.includes(propertyType)) {
      throw new ApiError('Invalid property type', 400);
    }
    if (!requestTypes.includes(requestType)) {
      throw new ApiError('Invalid request type', 400);
    }
    // verfiy phone if provided
    if (phone && (typeof phone !== 'string' || !phone.trim())) {
      throw new ApiError('Invalid phone number', 400);
    }

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
      if (lat < -90 || lat > 90) throw new ApiError('locationLat out of range', 400);
      if (lng < -180 || lng > 180) throw new ApiError('locationLong out of range', 400);
    }

    const record = await PropertyRequest.create({
      userId: user.id,
      message: message.trim(),
      propertyType,
      requestType,
      phone: phone || null,
      locationLat: lat,
      locationLong: lng,
      address: hasAddress ? address : null,
      major: major || null,
    });

    return record;
  }

  static async list(filters = {}) {
    const { page = 1, limit = 20, status } = filters;
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));

    const where = {};
    if (status) where.status = status;

    const { rows, count } = await PropertyRequest.findAndCountAll({
      where,
      include: [{ model: User, as: 'user' }],
      order: [['createdat', 'DESC']],
      limit: l,
      offset: (p - 1) * l,
    });

    const items = rows.map((row) => {
      const data = row.toJSON();
      delete data.userId;
      return data;
    });

    const totalPages = Math.ceil(count / l);
    return { items, page: p, limit: l, total: count, totalPages };
  }

  static async listByUser(user, filters = {}) {
    const { page = 1, limit = 20, status } = filters;
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));

    const where = { userId: user.id };
    if (status) where.status = status;

    const { rows, count } = await PropertyRequest.findAndCountAll({
      where,
      include: [{ model: User, as: 'user' }],
      order: [['createdat', 'DESC']],
      limit: l,
      offset: (p - 1) * l,
    });

    const items = rows.map((row) => {
      const data = row.toJSON();
      delete data.userId;
      return data;
    });

    const totalPages = Math.ceil(count / l);
    return { items, page: p, limit: l, total: count, totalPages };
  }

  static async getById(id) {
    const record = await PropertyRequest.findByPk(id, {
      include: [{ model: User, as: 'user' }],
    });
    if (!record) throw new ApiError('Property request not found', 404);
    const data = record.toJSON();
    delete data.userId;
    return data;
  }

  static async updateStatus(id, status) {
    const record = await PropertyRequest.findByPk(id);
    if (!record) throw new ApiError('Property request not found', 404);

    const allowedNext = Object.values(requestStatusTransitions)
      .filter((t) => t.from === record.status)
      .map((t) => t.to);
    if (!allowedNext.includes(status)) {
      throw new ApiError(`Invalid transition from ${record.status} to ${status}`, 400);
    }

    await record.update({ status });

    try {
      await notify(null, {
        userId: record.userId,
        type: 'property_request_status',
        message: {
          title: 'Property request status updated',
          body: `Your property request is now ${status}.`,
        },
      });
    } catch (e) {
      console.error('Notification error (property request status):', e);
    }

    return record;
  }

  static async delete(id, actor) {
    const record = await PropertyRequest.findByPk(id);
    if (!record) throw new ApiError('Property request not found', 404);

    const isAdmin = actor.role === 'admin' || actor.role === 'super_admin';
    if (!isAdmin && record.userId !== actor.id) {
      throw new ApiError('Forbidden', 403);
    }

    await record.destroy();
    return { deleted: true };
  }
}

module.exports = PropertyRequestService;
