const express = require('express');
const router = express.Router();
const badgeController = require('../controllers/badgeController');
const { auth } = require('../middleware/authMiddleware');

// Public routes (anyone can view)
router.get('/all', badgeController.getAllBadges);
router.get('/user/:userId', badgeController.getUserBadges);
router.get('/stats/:userId', badgeController.getUserStats);
router.get('/leaderboard', badgeController.getLeaderboard);

// Authenticated routes
router.use(auth);
router.get('/my-badges', badgeController.getUserBadges);
router.post('/check-awards', badgeController.checkAndAwardBadges);

// Admin routes
router.post('/admin/award', badgeController.adminAwardBadge);

module.exports = router;
