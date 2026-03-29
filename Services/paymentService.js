const sequelize = require('../config/database');
const { Payment, Application } = require('../Models');
const ApiError = require('../utils/ApiError');
const notify = require('./notificationService');

const { APP_STATUS } = require('../config/constants');

class PaymentService {
  static async listForContext(user, { page = 1, limit = 20, status } = {}) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;

    const where = {};
    if (status) where.status = status;

    if (user.role === 'landlord') {
      where.landlordId = user.id;
    } else if (user.role === 'admin') {
      // admins can see all payments
    } else {
      throw new ApiError('Forbidden', 403);
    }

    const offset = (p - 1) * l;

    const { rows, count } = await Payment.findAndCountAll({
      where,
      order: [['createdat', 'DESC']],
      limit: l,
      offset,
    });

    return {
      items: rows,
      page: p,
      limit: l,
      total: count,
    };
  }

  static async markReceived(actor, paymentId) {
    if (!actor || actor.role !== 'admin') throw new ApiError('Forbidden', 403);

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
    if (!actor || actor.role !== 'admin') throw new ApiError('Forbidden', 403);

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
}

module.exports = PaymentService;
