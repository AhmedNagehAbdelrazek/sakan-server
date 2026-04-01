const asyncHandler = require('express-async-handler');
const HousingNeedRequestService = require('../Services/housingNeedRequestService');

exports.create = asyncHandler(async (req, res) => {
  const created = await HousingNeedRequestService.create(req.user, req.body);
  res.status(201).json(created);
});

exports.list = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    area,
    includeDemandSummary,
  } = req.query;

  const out = await HousingNeedRequestService.listForAdmin(req.user, {
    page: Number(page),
    limit: Number(limit),
    status,
    area,
    includeDemandSummary:
      includeDemandSummary === true || includeDemandSummary === 'true',
  });

  res.json(out);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const out = await HousingNeedRequestService.updateStatus(
    req.user,
    req.params.id,
    req.body.status
  );

  res.json(out);
});
