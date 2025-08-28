// /Services/flatmateRequestService.js
const { Op, QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const { FlatmateRequest, JoinInterest, UserProfile } = require('../Models');
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

class FlatmateRequestService {
  // Create a new flatmate request (student only)
  /**
   * example
   * body{
   *  "preferredBudget":1000,
   *  "preferredType":"apartment",
   *  "message":"I want to find a flatmate",
   *  "peopleWanted":1,
   *  "radiusKm":10,
   *  "locationLat":0,
   *  "locationLong":0,
   * }
   */
  static async create(student, payload) {
    if (student.role !== 'student') throw new ApiError('Forbidden', 403);

    const {
      preferredBudget,
      preferredType,
      message,
      peopleWanted,
      radiusKm,
      locationLat,
      locationLong,
    } = payload;

    if (!propertyTypes.includes(preferredType)) throw new ApiError('Invalid preferredType', 400);

    const budget = Number(preferredBudget);
    const people = Number(peopleWanted);
    const radius = Number(radiusKm);
    const lat = Number(locationLat);
    const lng = Number(locationLong);

    assertFiniteNumber(budget, 'preferredBudget');
    assertFiniteNumber(people, 'peopleWanted');
    assertFiniteNumber(radius, 'radiusKm');
    validateLatLng(lat, lng);

    const reqRecord = await FlatmateRequest.create({
      userId: student.id,
      preferredBudget: budget,
      preferredType,
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
  static async delete(student, requestId) {
    if (student.role !== 'student') throw new ApiError('Forbidden', 403);

    const reqRecord = await FlatmateRequest.findByPk(requestId);
    if (!reqRecord) throw new ApiError('Flatmate request not found', 404);
    if (reqRecord.userId !== student.id) throw new ApiError('Forbidden', 403);

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
        order: [['createdAt', 'DESC']],
      });
    }
    if (!baseReq) throw new ApiError('No active flatmate request found', 404);
    return baseReq;
  }

  // Find matching flatmate requests for a user's base request
  // Strategy: filter by type, budget within tolerance, within geographic radius (Haversine with bounding box)
  static async findMatches(user, {
    requestId,
    budgetTolerance = 0.2, // 20%
    page = 1,
    limit = 20,
    radiusStrategy = 'min', // 'min' or 'max' radius overlap
    gender, // optional
    university, // optional
  } = {}) {
    if (user.role !== 'student') throw new ApiError('Forbidden', 403);

    const base = await this.getBaseRequestForUser(user.id, requestId);
    const p = Number(page);
    const l = Number(limit);
    const tol = Number(budgetTolerance);
    if (tol < 0 || tol > 1) throw new ApiError('budgetTolerance must be between 0 and 1', 400);

    // Bounding box prefilter
    const lat = Number(base.locationLat);
    const lng = Number(base.locationLong);
    const rBase = Number(base.radiusKm);
    const latDelta = rBase / 111;
    const lngDelta = rBase / (111 * Math.cos((Math.PI * lat) / 180) || 1e-6);

    // Budget window
    const minBudget = Number(base.preferredBudget) * (1 - tol);
    const maxBudget = Number(base.preferredBudget) * (1 + tol);

    // Optional profile filters (joins done in a second pass to avoid raw SQL complexity)
    const profileFilters = {};
    if (gender) profileFilters.gender = gender;
    if (university) profileFilters.university = university;

    // Raw selection for geo + budget + type; exclude own requests and matched
    const sql = `
      SELECT *
      FROM "flatmate_requests"
      WHERE "is_matched" = false
        AND "user_id" != :userId
        AND "preferred_type" = :type
        AND "preferred_budget" BETWEEN :minBudget AND :maxBudget
        AND "location_lat" BETWEEN :minLat AND :maxLat
        AND "location_long" BETWEEN :minLng AND :maxLng
        AND (
          6371 * acos(
            cos(pi() * :lat / 180) * cos(pi() * "location_lat" / 180) *
            cos(pi() * "location_long" / 180 - pi() * :lng / 180) +
            sin(pi() * :lat / 180) * sin(pi() * "location_lat" / 180)
          )
        ) <= CASE
              WHEN :radiusStrategy = 'max'
              THEN GREATEST(:rBase, "radius_km")
              ELSE LEAST(:rBase, "radius_km")
            END
      ORDER BY
        abs("preferred_budget" - :baseBudget) ASC,
        "createdat" DESC
      LIMIT :limit OFFSET :offset;
    `;

    const candidates = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements: {
        userId: user.id,
        type: base.preferredType,
        minBudget,
        maxBudget,
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
        lat,
        lng,
        rBase,
        baseBudget: Number(base.preferredBudget),
        radiusStrategy,
        limit: l,
        offset: (p - 1) * l,
      },
    });

    // Optional filter by profile attributes
    if (gender || university) {
      const userIds = candidates.map(c => c.user_id);
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
        items: candidates.filter(c => allowed.has(c.user_id)),
        page: p,
        limit: l,
      };
    }

    return { baseRequest: base, items: candidates, page: p, limit: l };
  }

  // A student expresses interest in someone else’s request
  static async createJoinInterest(student, flatmateRequestId, { message } = {}) {
    if (student.role !== 'student') throw new ApiError('Forbidden', 403);

    const target = await FlatmateRequest.findByPk(flatmateRequestId);
    if (!target) throw new ApiError('Flatmate request not found', 404);
    if (target.userId === student.id) throw new ApiError('Cannot join your own request', 400); 
    if (target.isMatched) throw new ApiError('This request is already matched', 400);

    const existing = await JoinInterest.findOne({
      where: {
        requesterId: student.id,
        flatmateRequestId: target.id,
        status: { [Op.in]: ['pending', 'accepted'] },
      },
    });
    if (existing) throw new ApiError('You already expressed interest for this request', 409);

    const ji = await JoinInterest.create({
      requesterId: student.id,
      flatmateRequestId: target.id,
      message: message || null,
      status: 'pending',
    });

    return ji;
  }

  // List current user join interests
  static async listMyJoinInterests(student, { page = 1, limit = 20, status } = {}) {
    if (student.role !== 'student') throw new ApiError('Forbidden', 403);

    const where = { requesterId: student.id };
    if (status) where.status = status;

    const p = Number(page);
    const l = Number(limit);
    const { rows, count } = await JoinInterest.findAndCountAll({
      where,
      order: [['createdat', 'DESC']],
      limit: l,
      offset: (p - 1) * l,
    });

    return { items: rows, page: p, limit: l, total: count };
  }

  // Owner accepts a join interest -> marks request matched; rejects others on same request
  static async acceptJoinInterest(owner, joinInterestId) {
    if (owner.role !== 'student') throw new ApiError('Forbidden', 403);

    return await sequelize.transaction(async (t) => {
      const ji = await JoinInterest.findByPk(joinInterestId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!ji) throw new ApiError('Join interest not found', 404);

      const reqRecord = await FlatmateRequest.findByPk(ji.flatmateRequestId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!reqRecord) throw new ApiError('Flatmate request not found', 404);
      if (reqRecord.userId !== owner.id) throw new ApiError('Forbidden', 403);
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
  static async rejectJoinInterest(owner, joinInterestId) {
    if (owner.role !== 'student') throw new ApiError('Forbidden', 403);

    const ji = await JoinInterest.findByPk(joinInterestId);
    if (!ji) throw new ApiError('Join interest not found', 404);

    const reqRecord = await FlatmateRequest.findByPk(ji.flatmateRequestId);
    if (!reqRecord) throw new ApiError('Flatmate request not found', 404);
    if (reqRecord.userId !== owner.id) throw new ApiError('Forbidden', 403);
    if (reqRecord.isMatched) throw new ApiError('Request already matched', 400);

    if (ji.status !== 'pending') throw new ApiError('Only pending interests can be rejected', 400);

    await ji.update({ status: 'rejected' });
    return ji;
  }
}

module.exports = FlatmateRequestService;
