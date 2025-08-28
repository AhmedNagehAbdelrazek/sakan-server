// /Controllers/flatmateRequestController.js
const asyncHandler = require('express-async-handler');
const FlatmateRequestService = require('../Services/flatmateRequestService');

/**
 * example
 * body{
 *  "title":"request a faltmate",
 *  "description":"I want to find a flatmate",
 *  "pricePerMonth":1000,
 *  "totalRooms":1,
 *  "availableRooms":1,
 *  "type":"apartment",
 *  "locationLat":0,
 *  "locationLong":0,
 *  "address":"",
 *  "amenities":{}
 * }
 */
exports.create = asyncHandler(async (req, res) => {
  const created = await FlatmateRequestService.create(req.user, req.body);
  res.status(201).json(created);
});

exports.deleteOne = asyncHandler(async (req, res) => {
  const out = await FlatmateRequestService.delete(req.user, req.params.id);
  res.json(out);
});

exports.matches = asyncHandler(async (req, res) => {
  const { requestId, budgetTolerance, page, limit, radiusStrategy, gender, university } = req.query;
  const result = await FlatmateRequestService.findMatches(req.user, {
    requestId,
    budgetTolerance: budgetTolerance != null ? Number(budgetTolerance) : undefined,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    radiusStrategy: radiusStrategy || 'min',
    gender,
    university,
  });
  res.json(result);
});

exports.createJoinInterest = asyncHandler(async (req, res) => {
  const ji = await FlatmateRequestService.createJoinInterest(req.user, req.params.id, { message: req.body.message });
  res.status(201).json(ji);
});
