// /Controllers/propertyController.js
const asyncHandler = require('express-async-handler');
const PropertyService = require('../Services/propertyService');

exports.createProperty = asyncHandler(async (req, res) => {
  const prop = await PropertyService.createForLandlord(req.user.id, req.body);
  res.status(201).json(prop);
});

exports.listProperties = asyncHandler(async (req, res) => {
  const { page, limit, isActive } = req.query;
  const result = await PropertyService.listForUser(req.user, {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    isActive: typeof isActive === 'undefined' ? true : isActive === 'true',
  });
  res.json(result);
});

exports.getProperty = asyncHandler(async (req, res) => {
  const prop = await PropertyService.getByIdForViewer(req.user, req.params.id);
  res.json(prop);
});

exports.updateProperty = asyncHandler(async (req, res) => {
  const updated = await PropertyService.updateForOwnerOrAdmin(req.user, req.params.id, req.body);
  res.json(updated);
});

exports.deleteProperty = asyncHandler(async (req, res) => {
  const out = await PropertyService.softDelete(req.user, req.params.id);
  res.json(out);
});

exports.nearbyCount = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.long);
  const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 5;

  const result = await PropertyService.nearbyCount({ lat, lng, radiusKm });
  res.json(result);
});
