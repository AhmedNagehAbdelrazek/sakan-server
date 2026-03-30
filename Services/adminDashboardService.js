class AdminDashboardService {
  static async getDashboard({ range = {}, limit = 20 } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    return {
      range: {
        from: range.from || null,
        to: range.to || null,
      },
      metrics: {
        users: {
          newUsersCount: 0,
          totalUsersCount: 0,
        },
        properties: {
          activeListingsCount: 0,
          newListingsCount: 0,
        },
        applications: {
          byStatus: {
            pending: 0,
            approved: 0,
            rejected: 0,
            paid: 0,
            checked_in: 0,
            completed: 0,
          },
        },
        payments: {
          byStatus: {
            pending: 0,
            received: 0,
            released: 0,
            refunded: 0,
          },
        },
      },
      needsAttention: {
        applications: [],
        payments: [],
      },
      trends: {
        applications: [],
        payments: [],
      },
      meta: {
        limit: safeLimit,
      },
    };
  }
}

module.exports = AdminDashboardService;
