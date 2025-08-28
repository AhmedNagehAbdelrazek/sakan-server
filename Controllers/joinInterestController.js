// /Controllers/joinInterestController.js
const asyncHandler = require('express-async-handler');
const FlatmateRequestService = require('../Services/flatmateRequestService');

exports.mine = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await FlatmateRequestService.listMyJoinInterests(req.user, {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    status,
  });
  res.json(result);
});

exports.accept = asyncHandler(async (req, res) => {
  const out = await FlatmateRequestService.acceptJoinInterest(req.user, req.params.id);
  res.json(out);
});

exports.reject = asyncHandler(async (req, res) => {
  const out = await FlatmateRequestService.rejectJoinInterest(req.user, req.params.id);
  res.json(out);
});
