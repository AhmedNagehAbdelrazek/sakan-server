const { Op, fn, col } = require('sequelize');
const { User, Property, Application, Payment, PropertyRequest } = require('../Models');
const { resolveDateRange } = require('../utils/dateRange');
const ActivityService = require('./activityService');

const ALL_APPLICATION_STATUSES = ['pending', 'approved', 'paid', 'checked_in', 'rejected', 'refunded', 'completed'];
const ALL_PAYMENT_STATUSES = ['pending', 'received', 'released', 'refunded'];

function statusCountMap(rows, allStatuses) {
  const map = Object.fromEntries(allStatuses.map((s) => [s, 0]));
  for (const row of rows) {
    if (row.dataValues && map[row.dataValues.status] !== undefined) {
      map[row.dataValues.status] = Number(row.dataValues.count);
    }
  }
  return map;
}

function zeroFilledTrends(countRows, from, to) {
  const countsByDay = {};
  for (const row of countRows) {
    const raw = row.dataValues ? row.dataValues.date : null;
    if (raw) countsByDay[new Date(raw).toISOString().slice(0, 10)] = Number(row.dataValues.count);
  }

  const buckets = [];
  if (!from || !to) return buckets;

  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({ date: key, count: countsByDay[key] || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

class AdminDashboardService {
  static async getDashboard({ actor, range = {}, limit = 20 } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const resolved = resolveDateRange(range);
    const { from, to } = resolved;

    const rangeWhere = {};
    if (from || to) {
      rangeWhere.createdat = {};
      if (from) rangeWhere.createdat[Op.gte] = from;
      if (to) rangeWhere.createdat[Op.lte] = to;
    }

    const [newUsersCount, totalUsersCount] = await Promise.all([
      User.count({ where: rangeWhere }),
      User.count(),
    ]);

    const [activeListingsCount, newListingsCount] = await Promise.all([
      Property.count({ where: { state: 'approved', isActive: true } }),
      Property.count({ where: rangeWhere }),
    ]);

    const [applicationRows, paymentRows] = await Promise.all([
      Application.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        where: rangeWhere,
        group: ['status'],
      }),
      Payment.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        where: rangeWhere,
        group: ['status'],
      }),
    ]);

    const [applications, payments, propertyRequests, properties] = await Promise.all([
      Application.findAll({ where: { status: 'pending' }, limit: safeLimit, order: [['createdat', 'DESC']] }),
      Payment.findAll({ where: { status: 'received' }, limit: safeLimit, order: [['createdat', 'DESC']] }),
      PropertyRequest.findAll({ where: { status: 'pending' }, limit: safeLimit, order: [['createdat', 'DESC']] }),
      Property.findAll({ where: { state: 'sent' }, limit: safeLimit, order: [['createdat', 'DESC']] }),
    ]);

    const [userTrendRows, applicationTrendRows, paymentTrendRows] = await Promise.all([
      User.findAll({
        attributes: [[fn('date_trunc', 'day', col('createdat')), 'date'], [fn('COUNT', col('id')), 'count']],
        where: rangeWhere,
        group: [fn('date_trunc', 'day', col('createdat'))],
        order: [[fn('date_trunc', 'day', col('createdat')), 'ASC']],
      }),
      Application.findAll({
        attributes: [[fn('date_trunc', 'day', col('createdat')), 'date'], [fn('COUNT', col('id')), 'count']],
        where: rangeWhere,
        group: [fn('date_trunc', 'day', col('createdat'))],
        order: [[fn('date_trunc', 'day', col('createdat')), 'ASC']],
      }),
      Payment.findAll({
        attributes: [[fn('date_trunc', 'day', col('createdat')), 'date'], [fn('COUNT', col('id')), 'count']],
        where: rangeWhere,
        group: [fn('date_trunc', 'day', col('createdat'))],
        order: [[fn('date_trunc', 'day', col('createdat')), 'ASC']],
      }),
    ]);

    if (actor) {
      await ActivityService.logUserActivity(actor, 'dashboard_viewed', {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      });
    }

    return {
      range: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
      metrics: {
        users: {
          newUsersCount,
          totalUsersCount,
        },
        properties: {
          activeListingsCount,
          newListingsCount,
        },
        applications: {
          byStatus: statusCountMap(applicationRows, ALL_APPLICATION_STATUSES),
        },
        payments: {
          byStatus: statusCountMap(paymentRows, ALL_PAYMENT_STATUSES),
        },
      },
      needsAttention: {
        applications,
        payments,
        propertyRequests,
        properties,
      },
      trends: {
        users: zeroFilledTrends(userTrendRows, from, to),
        applications: zeroFilledTrends(applicationTrendRows, from, to),
        payments: zeroFilledTrends(paymentTrendRows, from, to),
      },
      meta: {
        limit: safeLimit,
      },
    };
  }
}

module.exports = AdminDashboardService;
