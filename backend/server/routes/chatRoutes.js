const express = require('express');
const router = express.Router();
const {
  getChat,
  getEscrowChat,
  postMessage,
  getDirectChats,
  createDirectChat,
  getDirectChat,
  postDirectMessage,
  getSupportChats,
  getSupportChat,
  createSupportChat,
  postSupportMessage,
  banSupportChat,
  assignSupportChat,
  getUnreadSummary
} = require('../controllers/chatController');
const { auth } = require('../middleware/authMiddleware');

// Direct user-to-user chats
router.get('/direct', auth, getDirectChats);
router.get('/direct/chat/:chatId', auth, getDirectChat);
router.post('/direct/chat/:chatId/message', auth, express.json(), postDirectMessage);
router.post('/direct/:userId', auth, express.json(), createDirectChat);

// Unread/notification summary - must be registered before the /:txId catch-all
router.get('/meta/unread-count', auth, getUnreadSummary);

// Transaction-based chats
router.get('/:txId', auth, getChat);
router.get('/escrow/:txId', auth, getEscrowChat);
router.post('/:txId/message', auth, express.json(), postMessage);

// Support chats
router.get('/support/list/all', auth, getSupportChats);
router.post('/support/create', auth, express.json(), createSupportChat);
router.get('/support/:chatId/get', auth, getSupportChat);
router.post('/support/:chatId/message', auth, express.json(), postSupportMessage);
router.post('/support/:chatId/ban', auth, express.json(), banSupportChat);
router.post('/support/:chatId/assign', auth, express.json(), assignSupportChat);

module.exports = router;
