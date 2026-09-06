// /Services/applicationService.js
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Application, Property, Payment, User } = require('../Models');
const ApiError = require('../utils/ApiError');
const { getSupportContact } = require('../config/support');
const notify = require('./notificationService');

const {APP_STATUS, paymentMethods, currency: supportedCurrencies} = require('../config/constants');

function isApprovalExpired(app, now = new Date()) {
  if (!app) return false;
  if (app.status !== APP_STATUS.APPROVED) return false;
  if (!app.approvalExpiresAt) return false;
  return new Date(app.approvalExpiresAt).getTime() < now.getTime();
}

async function restoreOneRoom({ propertyId, transaction }) {
  const property = await Property.findByPk(propertyId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!property) return null;

  const total = Number(property.totalRooms);
  const avail = Number(property.availableRooms);
  const nextAvail = Number.isFinite(total)
    ? Math.min(avail + 1, total)
    : avail + 1;

  await property.update({ availableRooms: nextAvail }, { transaction });
  return property;
}

class ApplicationService {
  // Create an application by a student
  /**
   * example
   * body{
   *  "propertyId":1,
   *  "isForSharing":false,
   *  "message":"I want to find a flatmate",
   *  "totalAmount":1000,
   * }
   */
  static async createApplication(user, { propertyId, isForSharing = false, message, totalAmount }) {
    const property = await Property.findByPk(propertyId);
    if (!property || !property.isActive) throw new ApiError('Property not found or inactive', 404);
    if (property.userId === user.id) throw new ApiError('You cannot apply to your own property', 400);
    if (Number(property.availableRooms) <= 0) throw new ApiError('No available rooms for this property', 400);

    // Prevent duplicate active applications by same user on same property
    const existing = await Application.findOne({
      where: {
        userId: user.id,
        propertyId: property.id,
        status: { [Op.in]: [APP_STATUS.PENDING, APP_STATUS.APPROVED, APP_STATUS.PAID, APP_STATUS.CHECKED_IN] },
      },
    });
    if (existing) throw new ApiError('You already have an active application for this property', 409);

    // Default totalAmount to one month’s rent if not provided
    const amount = totalAmount != null ? Number(totalAmount) : Number(property.pricePerMonth);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError('Invalid totalAmount', 400);

    const app = await Application.create({
      userId: user.id,
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
    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.status !== APP_STATUS.PENDING) throw new ApiError('Only pending applications can be approved', 400);

      // Ensure property still has availability
      const property = await Property.findByPk(app.propertyId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!property || !property.isActive) throw new ApiError('Property not available', 400);
      if (Number(property.availableRooms) <= 0) throw new ApiError('No available rooms', 400);

      // Decrement capacity within the same transaction to prevent overbooking.
      await property.update({ availableRooms: Number(property.availableRooms) - 1 }, { transaction: t });

      const approvedAt = new Date();
      const approvalExpiresAt = new Date(approvedAt.getTime() + 24 * 60 * 60 * 1000);
      await app.update(
        {
          status: APP_STATUS.APPROVED,
          approvedBy: admin.id,
          approvedAt,
          approvalExpiresAt,
        },
        { transaction: t }
      );
      return app;
    });
  }

  // Admin rejects
  static async reject(admin, applicationId, { reasonCategory, detail } = {}) {
    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.status !== APP_STATUS.PENDING) throw new ApiError('Only pending applications can be rejected', 400);

      await app.update(
        {
          status: APP_STATUS.REJECTED,
          rejectionReason: reasonCategory,
          message: detail || reasonCategory,
        },
        { transaction: t }
      );
      return app;
    });
  }

  // Applicant initiates payment
  static async initiatePayment(user, applicationId, { method , currency }) {
    if (method != null && !paymentMethods.includes(method)) throw new ApiError('Invalid payment method', 400);

    const paymentCurrency = currency || 'EGP';
    if (paymentCurrency != null && !supportedCurrencies.includes(paymentCurrency)) {
      throw new ApiError('Invalid currency', 400);
    }

    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.userId !== user.id) throw new ApiError('You can only pay for your own application', 403);

      // Expire stale approvals before payment attempts.
      if (isApprovalExpired(app)) {
        await restoreOneRoom({ propertyId: app.propertyId, transaction: t });
        await app.update(
          {
            status: APP_STATUS.REJECTED,
            message: 'Approval expired',
          },
          { transaction: t }
        );
        throw new ApiError('Approval expired', 400);
      }

      if (app.status !== APP_STATUS.APPROVED) throw new ApiError('Application must be approved before payment', 400);

      const property = await Property.findByPk(app.propertyId, { transaction: t });
      if (!property || !property.isActive) throw new ApiError('Property not available', 400);

      // Create pending payment; actual confirmation should happen via payment webhook
      const payment = await Payment.create({
        applicationId: app.id,
        studentId: user.id,
        landlordId: property.userId,
        amount: app.totalAmount,
        status: 'pending',
        method: method ?? null,
        currency: paymentCurrency,
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

  // Applicant confirms check-in after payment
  static async checkIn(user, applicationId) {
    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.userId !== user.id) throw new ApiError('You can only check in for your own application', 403);
      if (app.status !== APP_STATUS.PAID) throw new ApiError('Application must be paid before check-in', 400);

      const now = new Date();
      await app.update({ status: APP_STATUS.CHECKED_IN, checkedInAt: now }, { transaction: t });

      // Durable notifications (emit optional)
      try {
        const property = await Property.findByPk(app.propertyId, { transaction: t });

        await notify(null, {
          userId: app.userId,
          type: 'application_checked_in',
          message: {
            title: 'Check-in confirmed',
            body: 'Your check-in has been recorded successfully.',
          },
        });

        if (property) {
          await notify(null, {
            userId: property.userId,
            type: 'application_checked_in',
            message: {
              title: 'Student checked in',
              body: 'A student has checked in for one of your applications.',
            },
          });
        }
      } catch (e) {
        console.error('Notification error (check-in):', e);
      }
      return app;
    });
  }

  // Admin marks completed (after payout release handled in Payment flow)
  static async complete(admin, applicationId) {
    return await sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) throw new ApiError('Application not found', 404);
      if (app.status !== APP_STATUS.CHECKED_IN) throw new ApiError('Only checked_in applications can be completed', 400);

      const now = new Date();
      await app.update({ status: APP_STATUS.COMPLETED, completedAt: now }, { transaction: t });

      // Durable notifications (emit optional)
      try {
        const property = await Property.findByPk(app.propertyId, { transaction: t });

        await notify(null, {
          userId: app.userId,
          type: 'application_completed',
          message: {
            title: 'Application completed',
            body: 'Your rental flow has been completed.',
          },
        });

        if (property) {
          await notify(null, {
            userId: property.userId,
            type: 'application_completed',
            message: {
              title: 'Application completed',
              body: 'An application for one of your properties has been completed.',
            },
          });
        }
      } catch (e) {
        console.error('Notification error (complete):', e);
      }
      return app;
    });
  }

  // Role-based listing with pagination
  static async listForContext(user, { page = 1, limit = 20, status } = {}) {
    const p = Number(page); const l = Number(limit);
    const where = {};
    if (status) where.status = status;

    const include = [];
    if (user.role === 'student' || user.role === 'landlord') {
      // Users see applications they submitted AND applications on their own properties
      where[Op.or] = [
        { userId: user.id },
        { '$Property.user_id$': user.id },
      ];
      include.push({ model: User, as: 'user' });
      include.push({
        model: Property,
        as: 'Property',
        required: true,
        attributes: ['id', 'title', 'userId'],
      });
    } else {
      include.push({ model: User, as: 'user' });
      include.push({ model: Property, as: 'Property' });
    }

    const serializeRows = (applicationRows) =>
      applicationRows.map((app) => {
        const data = app.toJSON();
        delete data.userId;
        delete data.propertyId;
        data.property = data.Property;
        delete data.Property;
        if (data.property) {
          delete data.property.userId;
        }
        return data;
      });

    const offset = (p - 1) * l;
    const { rows, count } = await Application.findAndCountAll({
      where,
      include,
      order: [['createdat', 'DESC']],
      limit: l,
      offset,
    });

    // Ensure expiry logic is observable on read paths.
    const now = new Date();
    const expiredIds = rows
      .filter((app) => isApprovalExpired(app, now))
      .map((app) => app.id);

    if (expiredIds.length === 0) {
      return { items: serializeRows(rows), page: p, limit: l, total: count };
    }

    // Expire sequentially (small batches expected) then re-query for consistent results.
    for (const id of expiredIds) {
      // eslint-disable-next-line no-await-in-loop
      await ApplicationService.expireApprovalIfNeeded(id);
    }

    const refreshed = await Application.findAndCountAll({
      where,
      include,
      order: [['createdat', 'DESC']],
      limit: l,
      offset,
    });

    return { items: serializeRows(refreshed.rows), page: p, limit: l, total: refreshed.count };
  }

  // Fetch single application with access control
  static async getById(user, applicationId) {
    const fetchApp = () => Application.findByPk(applicationId,{
      include:[
        {
          model:Property,
          as:'Property',
        },
        {
          model: Payment,
        },
        { model: User, as: 'user' },
      ]
    });

    let app = await fetchApp();
    if (!app) throw new ApiError('Application not found', 404);

    // Ensure expiry logic is observable on read paths.
    if (isApprovalExpired(app)) {
      await ApplicationService.expireApprovalIfNeeded(app.id);
      app = await fetchApp();
      if (!app) throw new ApiError('Application not found', 404);
    }

    const isOverseer = (user.role === 'admin' || user.role === 'super_admin' || user.role === 'manager');
    const isApplicant = (user.role === 'student' || user.role === 'landlord') && app.userId === user.id;
    const isPropertyOwner = (user.role === 'student' || user.role === 'landlord') && app.Property && app.Property.userId === user.id;
    if (!isOverseer && !isApplicant && !isPropertyOwner) {
      throw new ApiError('Forbidden', 403);
    }

    // Serialize and enrich with stable, user-facing derived fields.
    const data = app.toJSON();

    // Applicants must never see the exact address in-app.
    if (data.Property && user.role !== 'admin' && app.Property && app.Property.userId !== user.id) {
      data.Property.address = null;
    }

    // After approval (and beyond), instruct the applicant to contact support for exact details.
    if (
      app.userId === user.id &&
      [APP_STATUS.APPROVED, APP_STATUS.PAID, APP_STATUS.CHECKED_IN, APP_STATUS.COMPLETED].includes(data.status)
    ) {
      data.contactSupport = {
        message: 'Contact Sakan Support to receive check-in details.',
        contact: getSupportContact(),
      };
    }

    const payments = Array.isArray(data.Payments) ? data.Payments : [];
    const receiptCandidate = payments
      .filter((p) => p && (p.status === 'received' || p.status === 'released'))
      .sort((a, b) => {
        const aTime = new Date(a.receivedAt || a.createdat || 0).getTime();
        const bTime = new Date(b.receivedAt || b.createdat || 0).getTime();
        return bTime - aTime;
      })[0];

    if (receiptCandidate) {
      data.receipt = {
        paymentId: receiptCandidate.id,
        amount: receiptCandidate.amount,
        currency: receiptCandidate.currency,
        status: receiptCandidate.status,
        receivedAt: receiptCandidate.receivedAt || null,
        applicationId: data.id,
        propertyId: data.propertyId,
      };
    }

    // Replace the raw foreign-key ids with the related objects.
    delete data.userId;
    delete data.propertyId;
    data.property = data.Property;
    delete data.Property;
    if (data.property) {
      delete data.property.userId;
    }
    if (Array.isArray(data.Payments)) {
      data.Payments = data.Payments.map((pay) => {
        const p = { ...pay };
        delete p.studentId;
        delete p.landlordId;
        delete p.applicationId;
        return p;
      });
    }

    return data;
  }

  /**
   * Expires an approved application if its approval window has passed.
   * Restores the associated property's availableRooms by 1 (capped by totalRooms).
   */
  static async expireApprovalIfNeeded(applicationId) {
    return sequelize.transaction(async (t) => {
      const app = await Application.findByPk(applicationId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!app) return null;
      if (!isApprovalExpired(app)) return app;

      await restoreOneRoom({ propertyId: app.propertyId, transaction: t });
      await app.update(
        {
          status: APP_STATUS.REJECTED,
          message: 'Approval expired',
        },
        { transaction: t }
      );

      return app;
    });
  }
}

module.exports = ApplicationService;
module.exports.restoreOneRoom = restoreOneRoom;
