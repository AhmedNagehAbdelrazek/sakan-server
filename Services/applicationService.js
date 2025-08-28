// /Services/applicationService.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Application, Property, Payment } = require('../Models');
const ApiError = require('../utils/ApiError');

const ALLOWED_PAYMENT_METHODS = ['card', 'wallet', 'cash', 'transfer'];
const APP_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
  CHECKED_IN: 'checked_in',
  COMPLETED: 'completed',
};

class ApplicationService {
  // Create an application by a student
  static async createApplication(student, { propertyId, isForSharing = false, message, totalAmount }) {
    if (student.role !== 'student') throw new ApiError('Only students can create applications', 403);

    const property = await Property.findByPk(propertyId);
    if (!property || !property.isActive) throw new ApiError('Property not found or inactive', 404);
    if (property.userId === student.id) throw new ApiError('You cannot apply to your own property', 400);
    if (Number(property.availableRooms) <= 0) throw new ApiError('No available rooms for this property', 400);

    // Prevent duplicate active applications by same student on same property
    const existing = await Application.findOne({
      where: {
        userId: student.id,
        propertyId: property.id,
        status: { [Op.in]: [APP_STATUS.PENDING, APP_STATUS.APPROVED, APP_STATUS.PAID, APP_STATUS.CHECKED_IN] },
      },
    });
    if (existing) throw new ApiError('You already have an active application for this property', 409);

    // Default totalAmount to one month’s rent if not provided
    const amount = totalAmount != null ? Number(totalAmount) : Number(property.pricePerMonth);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError('Invalid totalAmount', 400);

    const app = await Application.create({
      userId: student.id,
      propertyId: property.id,
      isForSharing: !!isForSharing,
      message: message || null,
      status: APP_STATUS.PENDING,
      totalAmount: amount,
    });

    return app;
  }

  // Admin approves
  static async approve(admin, applicationId) {
    if (admin.role !== 'admin') throw new ApiError('Forbidden', 403);

    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.status !== APP_STATUS.PENDING) throw new ApiError('Only pending applications can be approved', 400);

      // Ensure property still has availability
      const property = await Property.findByPk(app.propertyId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!property || !property.isActive) throw new ApiError('Property not available', 400);
      if (Number(property.availableRooms) <= 0) throw new ApiError('No available rooms', 400);

      await app.update({ status: APP_STATUS.APPROVED, approvedBy: admin.id }, { transaction: t });
      return app;
    });
  }

  // Admin rejects
  static async reject(admin, applicationId, { reason } = {}) {
    if (admin.role !== 'admin') throw new ApiError('Forbidden', 403);

    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.status !== APP_STATUS.PENDING) throw new ApiError('Only pending applications can be rejected', 400);

      await app.update({ status: APP_STATUS.REJECTED, message: reason || app.message }, { transaction: t });
      return app;
    });
  }

  // Student initiates payment
  static async initiatePayment(student, applicationId, { method }) {
    if (student.role !== 'student') throw new ApiError('Forbidden', 403);
    if (!ALLOWED_PAYMENT_METHODS.includes(method)) throw new ApiError('Invalid payment method', 400);

    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.userId !== student.id) throw new ApiError('You can only pay for your own application', 403);
      if (app.status !== APP_STATUS.APPROVED) throw new ApiError('Application must be approved before payment', 400);

      const property = await Property.findByPk(app.propertyId, { transaction: t });
      if (!property || !property.isActive) throw new ApiError('Property not available', 400);

      // Create pending payment; actual confirmation should happen via payment webhook
      const payment = await Payment.create({
        applicationId: app.id,
        studentId: student.id,
        landlordId: property.userId,
        amount: app.totalAmount,
        status: 'pending',
        method,
      }, { transaction: t });

      return { application: app, payment };
    });
  }

  // Idempotent: called from payment webhook to mark app as paid
  static async markPaidByPayment(paymentIdOrProviderId) {
    return await sequelize.transaction(async (t) => {
      // Find payment by internal ID or provider ID
      const payment = await Payment.findOne({
        where: {
          [Op.or]: [
            { id: paymentIdOrProviderId },
            { providerPaymentId: paymentIdOrProviderId },
          ],
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!payment) throw new ApiError('Payment not found', 404);
      if (payment.status === 'received') return payment; // idempotent

      // Mark payment as received
      await payment.update({ status: 'received', paymentDate: new Date() }, { transaction: t });

      // Transition application to paid
      const app = await Application.findByPk(payment.applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found for payment', 404);

      // Only approved apps can become paid
      if (app.status === APP_STATUS.APPROVED) {
        await app.update({ status: APP_STATUS.PAID, paidAt: new Date() }, { transaction: t });
      }

      return payment;
    });
  }

  // Student confirms check-in after payment
  static async checkIn(student, applicationId) {
    if (student.role !== 'student') throw new ApiError('Forbidden', 403);

    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.userId !== student.id) throw new ApiError('You can only check in for your own application', 403);
      if (app.status !== APP_STATUS.PAID) throw new ApiError('Application must be paid before check-in', 400);

      await app.update({ status: APP_STATUS.CHECKED_IN }, { transaction: t });
      return app;
    });
  }

  // Admin marks completed (after payout release handled in Payment flow)
  static async complete(admin, applicationId) {
    if (admin.role !== 'admin') throw new ApiError('Forbidden', 403);

    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.status !== APP_STATUS.CHECKED_IN) throw new ApiError('Only checked_in applications can be completed', 400);

      await app.update({ status: APP_STATUS.COMPLETED }, { transaction: t });
      return app;
    });
  }

  // Role-based listing with pagination
  static async listForContext(user, { page = 1, limit = 20, status } = {}) {
    const p = Number(page); const l = Number(limit);
    const where = {};
    if (status) where.status = status;

    const include = [];
    if (user.role === 'student') {
      where.userId = user.id;
    } else if (user.role === 'landlord') {
      // Landlords see applications tied to their properties
      include.push({
        model: Property,
        as: 'Property',
        required: true,
        where: { userId: user.id },
        attributes: ['id', 'title', 'userId'],
      });
    } else if (user.role === 'admin') {
      // admins see all
    } else {
      throw new ApiError('Forbidden', 403);
    }

    const offset = (p - 1) * l;
    const { rows, count } = await Application.findAndCountAll({
      where,
      include,
      order: [['createdAt', 'DESC']],
      limit: l,
      offset,
    });

    return { items: rows, page: p, limit: l, total: count };
  }

  // Fetch single application with access control
  static async getById(user, applicationId) {
    const app = await Application.findByPk(applicationId, { include: [{ model: Property }] });
    if (!app) throw new ApiError('Application not found', 404);

    if (user.role === 'admin') return app;
    if (user.role === 'student' && app.userId === user.id) return app;
    if (user.role === 'landlord' && app.Property && app.Property.userId === user.id) return app;

    throw new ApiError('Forbidden', 403);
  }
}

module.exports = ApplicationService;
