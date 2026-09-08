const express = require('express');
const router = express.Router();
const { getNotifications, markAllRead, markNotificationRead } = require('../controllers/notificationController');
const { auth } = require('../middleware/authMiddleware');

router.get('/', auth, getNotifications);
router.post('/mark-all-read', auth, markAllRead);
router.patch('/:id/mark-read', auth, markNotificationRead);

module.exports = router;