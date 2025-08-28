// /Routes/flatmateRequestRoutes.js
const router = require('express').Router();
const protect = require('../middlewares/protect');
const verifyRole = require('../utils/verifyRole');
const {create,deleteOne,matches,createJoinInterest} = require('../Controllers/flatmateRequestController');
const {mine,accept,reject} = require('../Controllers/joinInterestController');

const {createFlatmateRequestValidator,deleteFlatmateRequestValidator,matchesValidator,joinInterestCreateValidator,joinInterestIdValidator,handleValidation,} = require('../utils/validators/flatmateValidators');

// Create a flatmate request (student)
router.post('/',protect,verifyRole('student'),createFlatmateRequestValidator,handleValidation,create);

// Get matches for the user's base request (or ?requestId=...)
router.get('/matches',protect,verifyRole('student'),matchesValidator,handleValidation,matches);

// Delete own flatmate request
router.delete('/:id',protect,verifyRole('student'),deleteFlatmateRequestValidator,handleValidation,deleteOne);

// Express interest in a request
router.post('/:id/join-interest',protect,verifyRole('student'),joinInterestCreateValidator,handleValidation,createJoinInterest);

// View my join interests
router.get('/join-interests/mine',protect,verifyRole('student'),mine);

// Accept/reject a join interest (owner of the request)
router.patch('/join-interests/:id/accept',protect,verifyRole('student'),joinInterestIdValidator,handleValidation,accept);
router.patch('/join-interests/:id/reject',protect,verifyRole('student'),joinInterestIdValidator,handleValidation,reject);

module.exports = router;
