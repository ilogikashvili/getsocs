/**
 * @swagger
 * /chats/direct:
 *   get:
 *     tags: [Chats]
 *     summary: getDirectChats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/direct/chat/{chatId}:
 *   get:
 *     tags: [Chats]
 *     summary: getDirectChat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: chatId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/direct/chat/{chatId}/message:
 *   post:
 *     tags: [Chats]
 *     summary: postDirectMessage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: chatId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/direct/{userId}:
 *   post:
 *     tags: [Chats]
 *     summary: createDirectChat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/meta/unread-count:
 *   get:
 *     tags: [Chats]
 *     summary: getUnreadSummary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/{txId}:
 *   get:
 *     tags: [Chats]
 *     summary: getChat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: txId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/escrow/{txId}:
 *   get:
 *     tags: [Chats]
 *     summary: getEscrowChat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: txId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/{txId}/message:
 *   post:
 *     tags: [Chats]
 *     summary: postMessage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: txId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/support/list/all:
 *   get:
 *     tags: [Chats]
 *     summary: getSupportChats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/support/create:
 *   post:
 *     tags: [Chats]
 *     summary: createSupportChat
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/support/{chatId}/get:
 *   get:
 *     tags: [Chats]
 *     summary: getSupportChat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: chatId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/support/{chatId}/message:
 *   post:
 *     tags: [Chats]
 *     summary: postSupportMessage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: chatId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/support/{chatId}/ban:
 *   post:
 *     tags: [Chats]
 *     summary: banSupportChat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: chatId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 * /chats/support/{chatId}/assign:
 *   post:
 *     tags: [Chats]
 *     summary: assignSupportChat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: chatId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: Request completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/Success"
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Resource not found
 */
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
const { chatLimiter } = require('../middleware/rateLimitMiddleware');

router.use(chatLimiter);

// Direct user-to-user chats
router.get('/direct', auth, getDirectChats);
router.get('/direct/chat/:chatId', auth, getDirectChat);
router.post('/direct/chat/:chatId/message', auth, express.json(), postDirectMessage);
router.post('/direct/:userId', auth, express.json(), createDirectChat);

// Unread/notification summary - must be registered before the /:txId catch-all
router.get('/meta/unread-count', auth, getUnreadSummary);

// Support chats
router.get('/support/list/all', auth, getSupportChats);
router.post('/support/create', auth, express.json(), createSupportChat);
router.get('/support/:chatId/get', auth, getSupportChat);
router.post('/support/:chatId/message', auth, express.json(), postSupportMessage);
router.post('/support/:chatId/ban', auth, express.json(), banSupportChat);
router.post('/support/:chatId/assign', auth, express.json(), assignSupportChat);

// Transaction-based chats
router.get('/escrow/:txId', auth, getEscrowChat);
router.get('/:txId', auth, getChat);
router.post('/:txId/message', auth, express.json(), postMessage);

module.exports = router;
