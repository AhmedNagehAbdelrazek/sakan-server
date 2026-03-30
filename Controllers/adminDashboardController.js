const asyncHandler = require('express-async-handler');
const adminDashboardService = require('../Services/adminDashboardService');

exports.getDashboard = asyncHandler(async (req, res) => {
  const { from, to, limit } = req.query;

  const result = await adminDashboardService.getDashboard({
    actor: req.user,
    range: { from, to },
    limit,
  });

  res.status(200).json(result);
});
