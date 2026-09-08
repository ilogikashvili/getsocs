/**
 * @swagger
 * /admin/ban/{id}:
 *   post:
 *     tags: [Admin]
 *     summary: banUser
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 * /admin/unban/{id}:
 *   post:
 *     tags: [Admin]
 *     summary: unbanUser
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 * /admin/make-escrow/{id}:
 *   post:
 *     tags: [Admin]
 *     summary: makeEscrow
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 * /admin/remove-escrow/{id}:
 *   post:
 *     tags: [Admin]
 *     summary: removeEscrow
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 * /admin/ban-escrow/{id}:
 *   post:
 *     tags: [Admin]
 *     summary: banEscrow
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 * /admin/role/{id}:
 *   post:
 *     tags: [Admin]
 *     summary: changeUserRole
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 * /admin/ads:
 *   post:
 *     tags: [Admin]
 *     summary: createAdSpace
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
 *   get:
 *     tags: [Admin]
 *     summary: listAdSpaces
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
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: listUsers
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
 * /admin/escrows:
 *   get:
 *     tags: [Admin]
 *     summary: listEscrows
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
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: getStats
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
 * /admin/stats/active-users:
 *   get:
 *     tags: [Admin]
 *     summary: getDailyActiveUsers
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
 * /admin/products:
 *   get:
 *     tags: [Admin]
 *     summary: listAdminProducts
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
 * /admin/comments:
 *   get:
 *     tags: [Admin]
 *     summary: getAdminComments
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
 * /admin/reviews:
 *   get:
 *     tags: [Admin]
 *     summary: getAdminReviews
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
 * /admin/chats:
 *   get:
 *     tags: [Admin]
 *     summary: listChats
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
 * /admin/ip-bans:
 *   post:
 *     tags: [Admin]
 *     summary: banIpAddress
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
 *   delete:
 *     tags: [Admin]
 *     summary: unbanIpAddress
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
 *   get:
 *     tags: [Admin]
 *     summary: listBannedIps
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
 * /admin/id-verifications:
 *   get:
 *     tags: [Admin]
 *     summary: listIdVerifications
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
 * /admin/id-verifications/{userId}/image:
 *   get:
 *     tags: [Admin]
 *     summary: getIdVerificationImage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
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
 * /admin/id-verifications/{userId}/review:
 *   post:
 *     tags: [Admin]
 *     summary: reviewIdVerification
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
 */
const express = require('express');
const router = express.Router();
const { banUser, unbanUser, makeEscrow, removeEscrow, banEscrow, changeUserRole, createAdSpace, listAdSpaces, listUsers, listEscrows, getStats, getDailyActiveUsers, listAdminProducts, listChats, getAdminComments, getAdminReviews, banIpAddress, unbanIpAddress, listBannedIps, listIdVerifications, getIdVerificationImage, reviewIdVerification } = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/authMiddleware');

router.post('/ban/:id', auth, requireRole('escrow', 'admin'), banUser);
router.post('/unban/:id', auth, requireRole('admin'), unbanUser);
router.post('/make-escrow/:id', auth, requireRole('admin'), makeEscrow);
router.post('/remove-escrow/:id', auth, requireRole('admin'), removeEscrow);
router.post('/ban-escrow/:id', auth, requireRole('admin'), banEscrow);
router.post('/role/:id', auth, requireRole('admin'), express.json(), changeUserRole);
router.post('/ads', auth, requireRole('admin'), express.json(), createAdSpace);
router.get('/ads', auth, requireRole('admin'), listAdSpaces);
router.get('/users', auth, requireRole('admin', 'escrow'), listUsers);
router.get('/escrows', auth, requireRole('admin'), listEscrows);
router.get('/stats', auth, requireRole('admin', 'escrow'), getStats);
router.get('/stats/active-users', auth, requireRole('admin', 'escrow'), getDailyActiveUsers);
router.get('/products', auth, requireRole('admin', 'escrow'), listAdminProducts);
router.get('/comments', auth, requireRole('admin', 'escrow'), getAdminComments);
router.get('/reviews', auth, requireRole('admin', 'escrow'), getAdminReviews);
router.get('/chats', auth, requireRole('admin', 'escrow'), listChats);
router.post('/ip-bans', auth, requireRole('admin'), express.json(), banIpAddress);
router.delete('/ip-bans', auth, requireRole('admin'), express.json(), unbanIpAddress);
router.get('/ip-bans', auth, requireRole('admin'), listBannedIps);
router.get('/id-verifications', auth, requireRole('admin', 'escrow'), listIdVerifications);
router.get('/id-verifications/:userId/image', auth, requireRole('admin', 'escrow'), getIdVerificationImage);
router.post('/id-verifications/:userId/review', auth, requireRole('admin', 'escrow'), express.json(), reviewIdVerification);

module.exports = router;
