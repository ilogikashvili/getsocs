/**
 * @swagger
 * /transactions/products/{id}/buy:
 *   post:
 *     tags: [Transactions]
 *     summary: buyProduct
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
 * /transactions:
 *   get:
 *     tags: [Transactions]
 *     summary: listTransactions
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
 * /transactions/pending:
 *   get:
 *     tags: [Transactions]
 *     summary: pendingTransactions
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
 * /transactions/{id}:
 *   get:
 *     tags: [Transactions]
 *     summary: getTransaction
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 * /transactions/{id}/confirm:
 *   post:
 *     tags: [Transactions]
 *     summary: confirmTransaction
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
 * /transactions/{id}/stage:
 *   post:
 *     tags: [Transactions]
 *     summary: setTransactionStage
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
 * /transactions/{id}/assign-escrow:
 *   post:
 *     tags: [Transactions]
 *     summary: assignEscrow
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
 */
const express = require('express');
const router = express.Router();
const { buyProduct, listTransactions, pendingTransactions, confirmTransaction, getTransaction, setTransactionStage, assignEscrow } = require('../controllers/transactionController');
const { auth } = require('../middleware/authMiddleware');
const { paymentLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/products/:id/buy', paymentLimiter, auth, buyProduct);
router.get('/', auth, listTransactions);
router.get('/pending', auth, pendingTransactions);
router.get('/:id', auth, getTransaction);
router.post('/:id/confirm', auth, confirmTransaction);
router.post('/:id/stage', auth, express.json(), setTransactionStage);
router.post('/:id/assign-escrow', auth, express.json(), assignEscrow);

module.exports = router;
