const { Op, fn, col } = require('sequelize');
const { HousingNeedRequest, User, UserProfile } = require('../Models');
const ApiError = require('../utils/ApiError');
const ActivityService = require('./activityService');

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function normalizeArea(area) {
  return String(area || '').trim().toLowerCase();
}

function buildFullName(firstName, lastName, fallbackUsername) {
  const full = `${firstName || ''} ${lastName || ''}`.trim();
  if (full) return full;
  return fallbackUsername || 'Unknown';
}

function canTransitionStatus(from, to) {
  return (
    (from === 'submitted' && to === 'reviewed') ||
    (from === 'reviewed' && to === 'closed')
  );
}

function serializeRequest(request) {
  const plain = request.get ? request.get({ plain: true }) : request;
  return {
    id: plain.id,
    userId: plain.userId,
    area: plain.area,
    areaNormalized: plain.areaNormalized,
    housingType: plain.housingType,
    message: plain.message,
    status: plain.status,
    reviewedAt: plain.reviewedAt,
    reviewedBy: plain.reviewedBy,
    closedAt: plain.closedAt,
    closedBy: plain.closedBy,
    createdAt: plain.createdat || plain.createdAt,
    updatedAt: plain.updatedat || plain.updatedAt,
  };
}

class HousingNeedRequestService {
  static async create(student, { area, housingType, message }) {
    if (!student || student.role !== 'student') {
      throw new ApiError('Forbidden', 403);
    }

    const cleanedArea = String(area || '').trim();
    const cleanedMessage = String(message || '').trim();
    const areaNormalized = normalizeArea(cleanedArea);

    const cutoff = new Date(Date.now() - COOLDOWN_MS);
    const duplicate = await HousingNeedRequest.findOne({
      where: {
        userId: student.id,
        areaNormalized,
        housingType,
        createdat: {
          [Op.gte]: cutoff,
        },
      },
      order: [['createdat', 'DESC']],
    });

    if (duplicate) {
      const createdAt = duplicate.createdat || duplicate.createdAt;
      const nextAllowedAt = new Date(new Date(createdAt).getTime() + COOLDOWN_MS);
      const err = new ApiError(
        `Duplicate request blocked by 7-day cooldown. Next allowed at ${nextAllowedAt.toISOString()}`,
        409
      );
      err.nextAllowedAt = nextAllowedAt.toISOString();
      throw err;
    }

    const created = await HousingNeedRequest.create({
      userId: student.id,
      area: cleanedArea,
      areaNormalized,
      housingType,
      message: cleanedMessage,
      status: 'submitted',
    });

    try {
      await ActivityService.logUserActivity(student, 'housing_request_submitted', {
        entityType: 'housing_request',
        entityId: created.id,
        area: cleanedArea,
        housingType,
      });
    } catch (e) {
      // Keep request creation non-blocking if activity logging fails.
      console.error('Activity log error (housing_request_submitted):', e);
    }

    return {
      ...serializeRequest(created),
      cooldownDays: COOLDOWN_DAYS,
    };
  }

  static async listForAdmin(admin, {
    page = 1,
    limit = 20,
    status,
    area,
    includeDemandSummary = false,
  } = {}) {
    if (!admin || admin.role !== 'admin') {
      throw new ApiError('Forbidden', 403);
    }

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const where = {};
    if (status) where.status = status;

    const areaFilter = String(area || '').trim();
    if (areaFilter) {
      where.area = { [Op.iLike]: `%${areaFilter}%` };
    }

    const { rows, count } = await HousingNeedRequest.findAndCountAll({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'email', 'phone'],
          include: [
            {
              model: UserProfile,
              attributes: ['firstName', 'lastName'],
              required: false,
            },
          ],
          required: true,
        },
      ],
      order: [['createdat', 'DESC']],
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    });

    const items = rows.map((row) => {
      const plain = row.get({ plain: true });
      const user = plain.User || {};
      const profile = user.UserProfile || {};

      return {
        id: plain.id,
        area: plain.area,
        housingType: plain.housingType,
        message: plain.message,
        status: plain.status,
        createdAt: plain.createdat || plain.createdAt,
        requester: {
          fullName: buildFullName(profile.firstName, profile.lastName, user.username),
          email: user.email || null,
          phone: user.phone || null,
        },
      };
    });

    const response = {
      items,
      page: safePage,
      limit: safeLimit,
      total: count,
    };

    if (includeDemandSummary) {
      const grouped = await HousingNeedRequest.findAll({
        where,
        attributes: ['areaNormalized', [fn('COUNT', col('id')), 'count']],
        group: ['areaNormalized'],
        raw: true,
      });

      response.demandSummary = grouped
        .map((row) => ({
          areaNormalized: row.areaNormalized,
          count: Number(row.count),
        }))
        .sort((a, b) => b.count - a.count || a.areaNormalized.localeCompare(b.areaNormalized));
    }

    return response;
  }

  static async updateStatus(admin, requestId, targetStatus) {
    if (!admin || admin.role !== 'admin') {
      throw new ApiError('Forbidden', 403);
    }

    const requestRecord = await HousingNeedRequest.findByPk(requestId);
    if (!requestRecord) {
      throw new ApiError('Housing need request not found', 404);
    }

    const currentStatus = requestRecord.status;
    if (!canTransitionStatus(currentStatus, targetStatus)) {
      throw new ApiError('Invalid status transition', 400);
    }

    const now = new Date();
    const updates = { status: targetStatus };
    if (targetStatus === 'reviewed') {
      updates.reviewedAt = now;
      updates.reviewedBy = admin.id;
    }
    if (targetStatus === 'closed') {
      updates.closedAt = now;
      updates.closedBy = admin.id;
    }

    await requestRecord.update(updates);

    const activityType =
      targetStatus === 'reviewed'
        ? 'housing_request_reviewed'
        : 'housing_request_closed';

    try {
      await ActivityService.logUserActivity(admin, activityType, {
        entityType: 'housing_request',
        entityId: requestRecord.id,
        fromStatus: currentStatus,
        toStatus: targetStatus,
      });
    } catch (e) {
      console.error(`Activity log error (${activityType}):`, e);
    }

    return serializeRequest(requestRecord);
  }
}

module.exports = HousingNeedRequestService;
module.exports.__testables = {
  COOLDOWN_DAYS,
  normalizeArea,
  buildFullName,
  canTransitionStatus,
};
