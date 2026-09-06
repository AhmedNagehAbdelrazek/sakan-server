const sequelize = require('../config/database');
const { Payment, Application, User } = require('../Models');
const ApiError = require('../utils/ApiError');
const notify = require('./notificationService');
const { restoreOneRoom } = require('./applicationService');

const { APP_STATUS } = require('../config/constants');

class PaymentService {
  static async listForContext(user, { page = 1, limit = 20, status } = {}) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;

    const where = {};
    if (status) where.status = status;

    if (user.role === 'landlord') {
      where.landlordId = user.id;
    }

    const offset = (p - 1) * l;

    const { rows, count } = await Payment.findAndCountAll({
      where,
      include: [
        { model: User, as: 'student' },
        { model: User, as: 'landlord' },
        { model: Application, as: 'application' },
      ],
      order: [['createdat', 'DESC']],
      limit: l,
      offset,
    });

    const items = rows.map((row) => {
      const data = row.toJSON();
      delete data.studentId;
      delete data.landlordId;
      delete data.applicationId;
      if (data.application) {
        delete data.application.userId;
        delete data.application.propertyId;
      }
      return data;
    });

    return {
      items,
      page: p,
      limit: l,
      total: count,
    };
  }

  static async markReceived(actor, paymentId) {
    return sequelize.transaction(async (t) => {
      const payment = await Payment.findByPk(paymentId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!payment) throw new ApiError('Payment not found', 404);

      if (payment.status === 'released') {
        throw new ApiError('Payment already released', 400);
      }

      const now = new Date();

      if (payment.status !== 'received') {
        await payment.update(
          {
            status: 'received',
            receivedAt: now,
            receivedBy: actor.id,
          },
          { transaction: t }
        );
      } else {
        const updates = {};
        if (!payment.receivedAt) updates.receivedAt = now;
        if (!payment.receivedBy) updates.receivedBy = actor.id;
        if (Object.keys(updates).length > 0) {
          await payment.update(updates, { transaction: t });
        }
      }

      const app = await Application.findByPk(payment.applicationId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!app) throw new ApiError('Application not found for payment', 404);

      if (app.status === APP_STATUS.APPROVED) {
        await app.update({ status: APP_STATUS.PAID, paidAt: now }, { transaction: t });
      } else if (app.status === APP_STATUS.PAID && !app.paidAt) {
        await app.update({ paidAt: now }, { transaction: t });
      }

      // Durable notifications (emit is optional; io may be null)
      // Keep failures here non-blocking for payment state transitions.
      try {
        await notify(null, {
          userId: payment.studentId,
          type: 'payment_received',
          message: {
            title: 'Payment received',
            body: 'Your payment has been confirmed by Sakan Support.',
          },
        });

        await notify(null, {
          userId: payment.landlordId,
          type: 'payment_received',
          message: {
            title: 'Payment received',
            body: 'A student payment has been confirmed for one of your properties.',
          },
        });
      } catch (e) {
        console.error('Notification error (payment received):', e);
      }

      return payment;
    });
  }

  static async markReleased(actor, paymentId) {
    return sequelize.transaction(async (t) => {
      const payment = await Payment.findByPk(paymentId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!payment) throw new ApiError('Payment not found', 404);

      if (payment.status === 'released') {
        return payment;
      }

      if (payment.status !== 'received') {
        throw new ApiError('Payment must be received before it can be released', 400);
      }

      const now = new Date();

      await payment.update(
        {
          status: 'released',
          releasedAt: now,
          releasedBy: actor.id,
        },
        { transaction: t }
      );

      try {
        await notify(null, {
          userId: payment.studentId,
          type: 'payment_released',
          message: {
            title: 'Payment released',
            body: 'Your payment has been released for landlord settlement.',
          },
        });

        await notify(null, {
          userId: payment.landlordId,
          type: 'payment_released',
          message: {
            title: 'Payout released',
            body: 'A payout has been released for one of your received payments.',
          },
        });
      } catch (e) {
        console.error('Notification error (payment released):', e);
      }

      return payment;
    });
  }

  static async markRefunded(actor, paymentId, reason) {
    return sequelize.transaction(async (t) => {
      const payment = await Payment.findByPk(paymentId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!payment) throw new ApiError('Payment not found', 404);

      if (payment.status === 'refunded') {
        throw new ApiError('Payment already refunded', 400);
      }

      if (payment.status !== 'received') {
        throw new ApiError('Only received (not yet released) payments can be refunded', 400);
      }

      const app = await Application.findByPk(payment.applicationId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!app) throw new ApiError('Application not found for payment', 404);
      if (app.status === APP_STATUS.COMPLETED) {
        throw new ApiError('Cannot refund a payment for a completed application', 400);
      }

      const now = new Date();
      await payment.update(
        {
          status: 'refunded',
          refundedAt: now,
          refundedBy: actor.id,
          refundReason: reason,
        },
        { transaction: t }
      );

      // Restore reserved room capacity and close out the application as refunded.
      const reserved = app.status === APP_STATUS.PAID || app.status === APP_STATUS.CHECKED_IN;
      if (reserved) {
        await restoreOneRoom({ propertyId: app.propertyId, transaction: t });
      }
      await app.update({ status: APP_STATUS.REFUNDED }, { transaction: t });

      try {
        await notify(null, {
          userId: payment.studentId,
          type: 'payment_refunded',
          message: {
            title: 'Payment refunded',
            body: 'Your payment has been refunded.',
          },
        });

        await notify(null, {
          userId: payment.landlordId,
          type: 'payment_refunded',
          message: {
            title: 'Payment refunded',
            body: 'A payment for one of your properties has been refunded.',
          },
        });
      } catch (e) {
        console.error('Notification error (payment refunded):', e);
      }

      return payment;
    });
  }
}

module.exports = PaymentService;
