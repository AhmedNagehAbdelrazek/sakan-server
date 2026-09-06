const { Op } = require('sequelize');
const { User, UserProfile, UserPreference } = require('../Models/index.js');
const ApiError = require('../utils/ApiError.js');

const USER_LIST_ATTRIBUTES = ['id', 'username', 'email', 'phone', 'countryCode', 'role', 'verified', 'active', 'createdat'];

class UserService {
  static async getAllUsers({ page = 1, limit = 20, search, role, verified, active } = {}) {
    const p = Number(page) || 1;
    const l = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const where = {};
    if (search) {
      where[Op.or] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (role) where.role = role;
    if (verified !== undefined && verified !== null && verified !== '') where.verified = verified === true || verified === 'true';
    if (active !== undefined && active !== null && active !== '') where.active = active === true || active === 'true';

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: USER_LIST_ATTRIBUTES,
      order: [['createdat', 'DESC']],
      limit: l,
      offset: (p - 1) * l,
    });

    return {
      items: rows,
      page: p,
      limit: l,
      total: count,
    };
  }

  static async getUserById(id, { includeProfile = false } = {}) {
    const include = [];
    if (includeProfile) {
      include.push({ model: UserProfile, as: 'profile', required: false });
      include.push({ model: UserPreference, as: 'preferences', required: false });
    }

    const user = await User.findByPk(id, {
      attributes: includeProfile ? undefined : USER_LIST_ATTRIBUTES,
      include,
    });

    if (!user) {
      throw new ApiError('User not found', 404);
    }

    return user;
  }

  static async updateUser(actor, id, { role, verified, active } = {}) {
    const target = await User.findByPk(id);
    if (!target) throw new ApiError('User not found', 404);

    if (role !== undefined && role !== target.role) {
      if (target.id === actor.id) {
        throw new ApiError('You cannot change your own role', 400);
      }
    }

    if (active === false) {
      if (target.id === actor.id) {
        throw new ApiError('You cannot deactivate your own account', 400);
      }
    }

    // Never remove the last active super admin (by demotion or deactivation).
    const demotingSuperAdmin = role !== undefined && role !== target.role && target.role === 'super_admin';
    const deactivatingSuperAdmin = active === false && target.role === 'super_admin';
    if (demotingSuperAdmin || deactivatingSuperAdmin) {
      const activeSuperAdmins = await User.count({ where: { role: 'super_admin', active: true } });
      if (activeSuperAdmins <= 1) {
        throw new ApiError('Cannot demote or deactivate the last active super admin', 400);
      }
    }

    const updates = {};
    if (role !== undefined) updates.role = role;
    if (verified !== undefined) updates.verified = verified;
    if (active !== undefined) updates.active = active;

    if (Object.keys(updates).length === 0) {
      throw new ApiError('No valid fields to update', 400);
    }

    await target.update(updates);
    return target;
  }
}

module.exports = UserService;
