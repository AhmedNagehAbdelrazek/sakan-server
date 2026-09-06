// /Routes/flatmateRequestRoutes.js
const router = require('express').Router();
const protect = require('../middlewares/protect');
const verifyRole = require('../utils/verifyRole');
const {create,deleteOne,matches,createJoinInterest,listAll,getById} = require('../Controllers/flatmateRequestController');
const {mine,accept,reject} = require('../Controllers/joinInterestController');

const {createFlatmateRequestValidator,deleteFlatmateRequestValidator,matchesValidator,joinInterestCreateValidator,joinInterestIdValidator,handleValidation,} = require('../utils/validators/flatmateValidators');

// Create a flatmate request (student & landlord)
router.post('/',protect,verifyRole('student','landlord'),createFlatmateRequestValidator,handleValidation,create);

// Get matches for the user's base request (or ?requestId=...)
router.get('/matches',protect,verifyRole('student','landlord'),matchesValidator,handleValidation,matches);

// Delete own flatmate request
router.delete('/:id',protect,verifyRole('student','landlord'),deleteFlatmateRequestValidator,handleValidation,deleteOne);

// Express interest in a request
router.post('/:id/join-interest',protect,verifyRole('student','landlord'),joinInterestCreateValidator,handleValidation,createJoinInterest);

// View my join interests
router.get('/join-interests/mine',protect,verifyRole('student','landlord'),mine);

// Accept/reject a join interest (owner of the request)
router.patch('/join-interests/:id/accept',protect,verifyRole('student','landlord'),joinInterestIdValidator,handleValidation,accept);
router.patch('/join-interests/:id/reject',protect,verifyRole('student','landlord'),joinInterestIdValidator,handleValidation,reject);

// Admin oversight (read-only; canOversee)
router.get('/',protect,verifyRole('admin','super_admin','manager'),listAll);
router.get('/:id',protect,verifyRole('admin','super_admin','manager'),getById);

module.exports = router;
