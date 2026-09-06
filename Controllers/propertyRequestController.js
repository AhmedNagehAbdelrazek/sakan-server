const asyncHandler = require('express-async-handler');
const PropertyRequestService = require('../Services/propertyRequestService');

exports.create = asyncHandler(async (req, res) => {
  const record = await PropertyRequestService.create(req.user, req.body);
  res.status(201).json(record);
});

exports.list = asyncHandler(async (req, res) => {
  const result = await PropertyRequestService.list(req.query);
  res.json(result);
});

exports.listMine = asyncHandler(async (req, res) => {
  const result = await PropertyRequestService.listByUser(req.user, req.query);
  res.json(result);
});

exports.getById = asyncHandler(async (req, res) => {
  const record = await PropertyRequestService.getById(req.params.id);
  res.json(record);
});

exports.remove = asyncHandler(async (req, res) => {
  const result = await PropertyRequestService.delete(req.params.id, req.user);
  res.json(result);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const record = await PropertyRequestService.updateStatus(req.params.id, status);
  res.json(record);
});
