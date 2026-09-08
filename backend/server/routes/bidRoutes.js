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
