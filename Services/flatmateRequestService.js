// /Services/flatmateRequestService.js
const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { FlatmateRequest, JoinInterest, UserProfile, User } = require('../Models');
const ApiError = require('../utils/ApiError');
const { propertyTypes } = require('../config/constants');

// Lightweight validators (keep consistent with route validators)
function assertFiniteNumber(n, name) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new ApiError(`${name} must be a finite number`, 400);
  }
}
function validateLatLng(lat, lng) {
  assertFiniteNumber(lat, 'locationLat');
  assertFiniteNumber(lng, 'locationLong');
  if (lat < -90 || lat > 90) throw new ApiError('locationLat out of range', 400);
  if (lng < -180 || lng > 180) throw new ApiError('locationLong out of range', 400);
}

function serializeForOverseer(row) {
  const data = row.toJSON();
  delete data.userId;
  if (Array.isArray(data.joinInterests)) {
    data.joinInterests = data.joinInterests.map((ji) => {
      const j = { ...ji };
      delete j.requesterId;
      delete j.flatmateRequestId;
      return j;
    });
  }
  return data;
}

// Only non-sensitive identity fields are exposed for other users' profiles.
const SAFE_USER_FIELDS = ['id', 'username', 'role'];

function safeOwner(userJson) {
  if (!userJson) return null;
  const safe = {};
  for (const key of SAFE_USER_FIELDS) safe[key] = userJson[key];
  return safe;
}

// Raw SQL match candidates carry only user_id; attach the related user object.
async function enrichCandidates(candidates) {
  if (!candidates || candidates.length === 0) return [];
  const userIds = [...new Set(candidates.map((c) => c.user_id))];
  const users = await User.findAll({ where: { id: { [Op.in]: userIds } } });
  const userMap = new Map(users.map((u) => [u.id, u.toJSON()]));
  return candidates.map((c) => {
    const candidate = { ...c };
    candidate.user = safeOwner(userMap.get(candidate.user_id));
    delete candidate.user_id;
    return candidate;
  });
}

class FlatmateRequestService {
  // Create a new flatmate request (student only)
  /**
   * example
   * body{
   *  "preferredBudget":1000,
   *  "preferredType":"apartment",
   *  "phoneNumber":"+201001234567",
   *  "message":"I want to find a flatmate",
   *  "peopleWanted":1,
   *  "radiusKm":10,     // optional
   *  "locationLat":0,   // optional (both coords together)
   *  "locationLong":0,  // optional
   * }
   */
  static async create(user, payload) {
    const {
      preferredBudget,
      preferredType,
      phoneNumber,
      message,
      peopleWanted,
      radiusKm,
      locationLat,
      locationLong,
    } = payload;

    if (!propertyTypes.includes(preferredType)) throw new ApiError('Invalid preferredType', 400);
    if (typeof phoneNumber !== 'string' || !phoneNumber.trim()) throw new ApiError('phoneNumber is required', 400);
    if (phoneNumber.trim().length > 20) throw new ApiError('phoneNumber must be at most 20 characters', 400);

    const budget = Number(preferredBudget);
    const people = Number(peopleWanted);

    assertFiniteNumber(budget, 'preferredBudget');
    assertFiniteNumber(people, 'peopleWanted');

    const hasLat = locationLat !== undefined && locationLat !== null && locationLat !== '';
    const hasLng = locationLong !== undefined && locationLong !== null && locationLong !== '';

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

    const radius = radiusKm != null && radiusKm !== '' ? Number(radiusKm) : null;
    if (radius != null) {
      assertFiniteNumber(radius, 'radiusKm');
      if (radius < 1 || radius > 100) throw new ApiError('radiusKm must be between 1 and 100', 400);
    }

    const reqRecord = await FlatmateRequest.create({
      userId: user.id,
      preferredBudget: budget,
      preferredType,
      phoneNumber: phoneNumber.trim(),
      message: message || null,
      peopleWanted: people,
      radiusKm: radius,
      locationLat: lat,
      locationLong: lng,
      isMatched: false,
    });

    return reqRecord;
  }

  // Delete a flatmate request (owner only)
  static async delete(user, requestId) {
    const reqRecord = await FlatmateRequest.findByPk(requestId);
    if (!reqRecord) throw new ApiError('Flatmate request not found', 404);
    if (reqRecord.userId !== user.id) throw new ApiError('Forbidden', 403);

    await reqRecord.destroy();
    return { deleted: true };
  }

  // Helper: get the base request for matching - either specified or latest active
  static async getBaseRequestForUser(userId, requestId) {
    let baseReq;
    if (requestId) {
      baseReq = await FlatmateRequest.findOne({ where: { id: requestId, userId } });
    } else {
      baseReq = await FlatmateRequest.findOne({
        where: { userId, isMatched: false },
        order: [['createdat', 'DESC']],
      });
    }
    if (!baseReq) throw new ApiError('No active flatmate request found', 404);
    return baseReq;
  }

  // Find matching flatmate requests for a user's base request
  // Strategy: filter by type, budget within tolerance, and (when the base
  // request has coordinates) within geographic radius (Haversine + bbox).
  // Location data is optional, so matching also works without a map.
  static async findMatches(user, {
    requestId,
    budgetTolerance = 0.2, // 20%
    page = 1,
    limit = 20,
    radiusStrategy = 'min', // 'min' or 'max' radius overlap
    gender, // optional
    university, // optional
  } = {}) {
    const base = await this.getBaseRequestForUser(user.id, requestId);
    const p = Number(page);
    const l = Number(limit);
    const tol = Number(budgetTolerance);
    if (tol < 0 || tol > 1) throw new ApiError('budgetTolerance must be between 0 and 1', 400);

    // Budget window
    const minBudget = Number(base.preferredBudget) * (1 - tol);
    const maxBudget = Number(base.preferredBudget) * (1 + tol);

    // Optional profile filters (joins done in a second pass to avoid raw SQL complexity)
    const profileFilters = {};
    if (gender) profileFilters.gender = gender;
    if (university) profileFilters.university = university;

    const replacements = {
      userId: user.id,
      type: base.preferredType,
      minBudget,
      maxBudget,
      baseBudget: Number(base.preferredBudget),
      radiusStrategy,
      limit: l,
      offset: (p - 1) * l,
    };

    // Geo is optional: when the base request has no coordinates, distance
    // matching is skipped and candidates are matched by budget/type/profile only.
    const geoClauses = [];
    const lat = base.locationLat != null ? Number(base.locationLat) : null;
    const lng = base.locationLong != null ? Number(base.locationLong) : null;
    const baseHasGeo = lat != null && lng != null;

    if (baseHasGeo) {
      const baseRadius = base.radiusKm != null ? Number(base.radiusKm) : null;
      // Reasonable default when coordinates exist but no radius was provided.
      const geoRadius = baseRadius != null ? baseRadius : 20;

      const latDelta = geoRadius / 111;
      const lngDelta = geoRadius / (111 * Math.cos((Math.PI * lat) / 180) || 1e-6);

      geoClauses.push(`"location_lat" BETWEEN :minLat AND :maxLat`);
      geoClauses.push(`"location_long" BETWEEN :minLng AND :maxLng`);
      geoClauses.push(`(
          6371 * acos(
            cos(pi() * :lat / 180) * cos(pi() * "location_lat" / 180) *
            cos(pi() * "location_long" / 180 - pi() * :lng / 180) +
            sin(pi() * :lat / 180) * sin(pi() * "location_lat" / 180)
          )
        ) <= CASE
              WHEN :radiusStrategy = 'max'
              THEN GREATEST(:geoRadius, COALESCE("radius_km", :geoRadius))
              ELSE LEAST(:geoRadius, COALESCE("radius_km", :geoRadius))
            END`);

      Object.assign(replacements, {
        lat,
        lng,
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
        geoRadius,
      });
    }

    // Raw selection for geo + budget + type; exclude own requests and matched
    const geoWhere = geoClauses.length > 0 ? `AND ${geoClauses.join('\n        AND ')}\n` : '';
    const sql = `
      SELECT *
      FROM "flatmate_requests"
      WHERE "is_matched" = false
        AND "user_id" != :userId
        AND "preferred_type" = :type
        AND "preferred_budget" BETWEEN :minBudget AND :maxBudget
        ${geoWhere}
      ORDER BY
        abs("preferred_budget" - :baseBudget) ASC,
        "createdat" DESC
      LIMIT :limit OFFSET :offset;
    `;

    const candidates = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements,
    });

    // Optional filter by profile attributes
    if (gender || university) {
      const enriched = (await enrichCandidates(candidates)).filter((c) => c.user);
      const userIds = enriched.map(c => c.user.id);
      const profiles = await UserProfile.findAll({
        where: {
          userId: { [Op.in]: userIds },
          ...(gender ? { gender } : {}),
          ...(university ? { university } : {}),
        },
        attributes: ['userId'],
      });
      const allowed = new Set(profiles.map(pr => pr.userId));
      return {
        baseRequest: base,
        items: enriched.filter(c => allowed.has(c.user.id)),
        page: p,
        limit: l,
      };
    }

    return { baseRequest: base, items: await enrichCandidates(candidates), page: p, limit: l };
  }

  // Admin oversight: read-only list of all flatmate requests with join interests
  static async listAll({ page = 1, limit = 20 } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));

    const { rows, count } = await FlatmateRequest.findAndCountAll({
      include: [
        { model: User, as: 'user' },
        {
          model: JoinInterest,
          as: 'joinInterests',
          required: false,
          include: [{ model: User, as: 'requester' }],
        },
      ],
      order: [['createdat', 'DESC']],
      limit: l,
      offset: (p - 1) * l,
    });

    const items = rows.map((row) => serializeForOverseer(row));

    return { items, page: p, limit: l, total: count, totalPages: Math.ceil(count / l) };
  }

  // Admin oversight: detail view including requester and all join interests
  static async getById(id) {
    const reqRecord = await FlatmateRequest.findByPk(id, {
      include: [
        { model: User, as: 'user', required: false },
        {
          model: JoinInterest,
          as: 'joinInterests',
          required: false,
          include: [{ model: User, as: 'requester', required: false }],
        },
      ],
    });
    if (!reqRecord) throw new ApiError('Flatmate request not found', 404);
    return serializeForOverseer(reqRecord);
  }

  // A user expresses interest in someone else’s request
  static async createJoinInterest(user, flatmateRequestId, { message } = {}) {
    const target = await FlatmateRequest.findByPk(flatmateRequestId);
    if (!target) throw new ApiError('Flatmate request not found', 404);
    if (target.userId === user.id) throw new ApiError('Cannot join your own request', 400); 
    if (target.isMatched) throw new ApiError('This request is already matched', 400);

    const existing = await JoinInterest.findOne({
      where: {
        requesterId: user.id,
        flatmateRequestId: target.id,
        status: { [Op.in]: ['pending', 'accepted'] },
      },
    });
    if (existing) throw new ApiError('You already expressed interest for this request', 409);

    const ji = await JoinInterest.create({
      requesterId: user.id,
      flatmateRequestId: target.id,
      message: message || null,
      status: 'pending',
    });

    return ji;
  }

  // List current user join interests
  static async listMyJoinInterests(user, { page = 1, limit = 20, status } = {}) {
    const where = { requesterId: user.id };
    if (status) where.status = status;

    const p = Number(page);
    const l = Number(limit);
    const { rows, count } = await JoinInterest.findAndCountAll({
      where,
      include: [
        { model: User, as: 'requester' },
        {
          model: FlatmateRequest,
          include: [{ model: User, as: 'user' }],
        },
      ],
      order: [['createdat', 'DESC']],
      limit: l,
      offset: (p - 1) * l,
    });

    const items = rows.map((row) => {
      const data = row.toJSON();
      delete data.requesterId;
      delete data.flatmateRequestId;
      if (data.FlatmateRequest) {
        delete data.FlatmateRequest.userId;
        if (data.FlatmateRequest.user) {
          data.FlatmateRequest.user = safeOwner(data.FlatmateRequest.user);
        }
      }
      return data;
    });

    return { items, page: p, limit: l, total: count };
  }

  // Owner accepts a join interest -> marks request matched; rejects others on same request
  static async acceptJoinInterest(user, joinInterestId) {
    return await sequelize.transaction(async (t) => {
      const ji = await JoinInterest.findByPk(joinInterestId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!ji) throw new ApiError('Join interest not found', 404);

      const reqRecord = await FlatmateRequest.findByPk(ji.flatmateRequestId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!reqRecord) throw new ApiError('Flatmate request not found', 404);
      if (reqRecord.userId !== user.id) throw new ApiError('Forbidden', 403);
      if (reqRecord.isMatched) throw new ApiError('Request already matched', 400);

      await ji.update({ status: 'accepted' }, { transaction: t });
      await reqRecord.update({ isMatched: true }, { transaction: t });

      // Reject other pending interests on the same request
      await JoinInterest.update(
        { status: 'rejected' },
        { where: { flatmateRequestId: reqRecord.id, status: 'pending', id: { [Op.ne]: ji.id } }, transaction: t }
      );

      return { joinInterest: ji, request: reqRecord };
    });
  }

  // Owner rejects a join interest
  static async rejectJoinInterest(user, joinInterestId) {
    const ji = await JoinInterest.findByPk(joinInterestId);
    if (!ji) throw new ApiError('Join interest not found', 404);

    const reqRecord = await FlatmateRequest.findByPk(ji.flatmateRequestId);
    if (!reqRecord) throw new ApiError('Flatmate request not found', 404);
    if (reqRecord.userId !== user.id) throw new ApiError('Forbidden', 403);
    if (reqRecord.isMatched) throw new ApiError('Request already matched', 400);

    if (ji.status !== 'pending') throw new ApiError('Only pending interests can be rejected', 400);

    await ji.update({ status: 'rejected' });
    return ji;
  }
}

module.exports = FlatmateRequestService;
