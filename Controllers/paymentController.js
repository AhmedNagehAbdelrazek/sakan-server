const PaymentService = require('../Services/paymentService');

async function listPayments(req, res, next) {
  try {
    const result = await PaymentService.listForContext(req.user, req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function markPaymentReceived(req, res, next) {
  try {
    const payment = await PaymentService.markReceived(req.user, req.params.id);
    res.status(200).json(payment.toJSON());
  } catch (err) {
    next(err);
  }
}

async function markPaymentReleased(req, res, next) {
  try {
    const payment = await PaymentService.markReleased(req.user, req.params.id);
    res.status(200).json(payment.toJSON());
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPayments,
  markPaymentReceived,
  markPaymentReleased,
};
