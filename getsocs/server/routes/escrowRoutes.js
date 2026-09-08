/**
 * @swagger
 * /escrow/initiate:
 *   post:
 *     tags: [Escrow]
 *     summary: escrowController initiateEscrow
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
 * /escrow/status/{transactionId}:
 *   get:
 *     tags: [Escrow]
 *     summary: escrowController getEscrowStatus
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
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
 * /escrow/timer/{transactionId}:
 *   get:
 *     tags: [Escrow]
 *     summary: escrowController getEscrowTimer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
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
 * /escrow/extend/{transactionId}:
 *   post:
 *     tags: [Escrow]
 *     summary: escrowController extendEscrow
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
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
 * /escrow/buyer-release/{transactionId}:
 *   post:
 *     tags: [Escrow]
 *     summary: escrowController buyerReleaseFunds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
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
 * /escrow/seller-release/{transactionId}:
 *   post:
 *     tags: [Escrow]
 *     summary: escrowController sellerReleaseFunds
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
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
 * /escrow/dispute/{transactionId}:
 *   post:
 *     tags: [Escrow]
 *     summary: escrowController disputeEscrow
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
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
 * /escrow/admin/complete/{transactionId}:
 *   post:
 *     tags: [Escrow]
 *     summary: escrowController adminCompleteEscrow
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
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
 * /escrow/admin/refund/{transactionId}:
 *   post:
 *     tags: [Escrow]
 *     summary: escrowController adminRefundEscrow
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: transactionId
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
 * /escrow/admin/disputes:
 *   get:
 *     tags: [Escrow]
 *     summary: escrowController adminViewDisputes
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
 * /escrow/admin/all:
 *   get:
 *     tags: [Escrow]
 *     summary: escrowController adminGetAllEscrows
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
 */
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
