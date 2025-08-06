const verifyRole = require('../utils/verifyRole');
const { getActivities, getActivity } = require('../Controllers/activitiesController');
const protect = require('../middlewares/protect');

const router = require("express").Router();

router.get('/',protect, verifyRole(['admin']), getActivities);
router.get('/:id',protect, verifyRole(['admin']), getActivity);

module.exports = router;
