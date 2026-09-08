/**
 * @swagger
 * /bids/place:
 *   post:
 *     tags: [Bids]
 *     summary: bidController placeBid
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
 * /bids/listing/{listingId}:
 *   get:
 *     tags: [Bids]
 *     summary: bidController getListingBids
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: listingId
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
 * /bids/my-bids:
 *   get:
 *     tags: [Bids]
 *     summary: bidController getUserBids
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
 * /bids/user/{userId}:
 *   get:
 *     tags: [Bids]
 *     summary: bidController getUserBids
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
 * /bids/accept/{bidId}:
 *   post:
 *     tags: [Bids]
 *     summary: bidController acceptBid
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: bidId
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
 * /bids/reject/{bidId}:
 *   post:
 *     tags: [Bids]
 *     summary: bidController rejectBid
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: bidId
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
 * /bids/cancel/{bidId}:
 *   post:
 *     tags: [Bids]
 *     summary: bidController cancelBid
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: bidId
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
const bidController = require('../controllers/bidController');
const { auth } = require('../middleware/authMiddleware');

// All bid routes require authentication
router.use(auth);

// User bid routes
router.post('/place', bidController.placeBid);
router.get('/listing/:listingId', bidController.getListingBids);
router.get('/my-bids', bidController.getUserBids);
router.get('/user/:userId', bidController.getUserBids);

// Bid actions (seller/bidder)
router.post('/accept/:bidId', bidController.acceptBid);
router.post('/reject/:bidId', bidController.rejectBid);
router.post('/cancel/:bidId', bidController.cancelBid);

module.exports = router;
