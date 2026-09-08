const express = require('express');
const router = express.Router();
const escrowController = require('../controllers/escrowController');
const { auth } = require('../middleware/authMiddleware');

// All escrow routes require authentication
router.use(auth);

// Public routes (for parties involved)
router.post('/initiate', express.json(), escrowController.initiateEscrow);
router.get('/status/:transactionId', escrowController.getEscrowStatus);
router.get('/timer/:transactionId', escrowController.getEscrowTimer);
router.post('/extend/:transactionId', express.json(), escrowController.extendEscrow);
router.post('/buyer-release/:transactionId', escrowController.buyerReleaseFunds);
router.post('/seller-release/:transactionId', escrowController.sellerReleaseFunds);
router.post('/dispute/:transactionId', express.json(), escrowController.disputeEscrow);

// Admin routes
router.post('/admin/complete/:transactionId', express.json(), escrowController.adminCompleteEscrow);
router.post('/admin/refund/:transactionId', express.json(), escrowController.adminRefundEscrow);
router.get('/admin/disputes', escrowController.adminViewDisputes);
router.get('/admin/all', escrowController.adminGetAllEscrows);

module.exports = router;
