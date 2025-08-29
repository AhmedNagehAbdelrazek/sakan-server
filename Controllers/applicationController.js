// /Controllers/applicationController.js
const asyncHandler = require('express-async-handler');
const ApplicationService = require('../Services/applicationService');

exports.create = asyncHandler(async (req, res) => {
  const app = await ApplicationService.createApplication(req.user, req.body);
  res.status(201).json(app);
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await ApplicationService.listForContext(req.user, {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    status,
  });
  res.json(result);
});

exports.getOne = asyncHandler(async (req, res) => {
  const app = await ApplicationService.getById(req.user, req.params.id);
  res.json(app);
});

exports.approve = asyncHandler(async (req, res) => {
  const app = await ApplicationService.approve(req.user, req.params.id);
  res.json(app);
});

exports.reject = asyncHandler(async (req, res) => {
  const app = await ApplicationService.reject(req.user, req.params.id, { reason: req.body.reason });
  res.json(app);
});

exports.pay = asyncHandler(async (req, res) => {
  const out = await ApplicationService.initiatePayment(req.user, req.params.id, { method: req.body.method , currency: req.body.currency || "EGP" });
  res.json(out);
});

exports.checkIn = asyncHandler(async (req, res) => {
  const app = await ApplicationService.checkIn(req.user, req.params.id);
  res.json(app);
});
