const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');
const { auth } = require('../middleware/authMiddleware');

// Public routes
router.get('/tiers', membershipController.getAllTiers);
router.get('/addons', membershipController.getAllAddOns);

// Authenticated routes
router.use(auth);
router.get('/my-membership', membershipController.getUserMembership);
router.get('/membership/:userId', membershipController.getUserMembership);
router.post('/subscribe', membershipController.subscribeToTier);
router.post('/cancel', membershipController.cancelMembership);
router.get('/fee', membershipController.getPlatformFee);

// Add-on routes
router.post('/addon/purchase', membershipController.purchaseAddOn);
router.get('/addon/my-addons', membershipController.getUserAddOns);
router.get('/addon/:userId', membershipController.getUserAddOns);
router.get('/addon/color/:userId', membershipController.getUsernameColor);

// Admin routes
router.get('/admin/subscriptions', membershipController.adminGetAllSubscriptions);
router.get('/admin/revenue', membershipController.adminGetRevenueStats);

module.exports = router;
