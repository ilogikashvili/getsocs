const express = require('express');
const router = express.Router();
const {
  getProducts,
  getMyProducts,
  createProduct,
  commentProduct,
  getProduct,
  getPendingProducts,
  approveProduct,
  deleteProduct,
  getLiveProducts,
  getPromotedProducts,
  getPremiumProducts,
  getExpiringProducts,
  promoteProduct,
  markPremiumProduct,
  hideProduct,
  publicizeProduct,
  claimProduct,
  submitProductClaim,
  listProductClaims,
  resolveProductClaim
} = require('../controllers/productController');
const { auth, optionalAuth, requireRole } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const { validateAndNormalizeImages } = require('../middleware/imageDimensionMiddleware');
const { lookupYoutubeChannel } = require('../controllers/youtubeController');

router.get('/', optionalAuth, getProducts);
router.get('/search', optionalAuth, getProducts);
router.get('/mine', auth, getMyProducts);
router.get('/live', getLiveProducts);
router.get('/promoted', getPromotedProducts);
router.get('/premium', getPremiumProducts);
router.get('/expiring', getExpiringProducts);
router.get('/pending', auth, requireRole('escrow', 'admin'), getPendingProducts);
router.get('/youtube-lookup', auth, lookupYoutubeChannel);
router.get('/:id', optionalAuth, getProduct);
router.post('/', auth, upload.array('images', 7), validateAndNormalizeImages, express.json(), createProduct);
router.post('/:id/comment', auth, express.json(), commentProduct);
router.post('/:id/approve', auth, requireRole('escrow', 'admin'), express.json(), approveProduct);
router.post('/:id/promote', auth, express.json(), promoteProduct);
router.post('/:id/premium', auth, express.json(), markPremiumProduct);
router.post('/:id/hide', auth, express.json(), hideProduct);
router.post('/:id/publicize', auth, express.json(), publicizeProduct);
router.get('/claims/pending', auth, requireRole('escrow', 'admin'), listProductClaims);
router.post('/:id/claim', auth, express.json(), claimProduct);
router.post('/:id/claim/submit', auth, express.json(), submitProductClaim);
router.post('/:id/claim/resolve', auth, requireRole('escrow', 'admin'), express.json(), resolveProductClaim);
router.delete('/:id', auth, requireRole('escrow', 'admin'), deleteProduct);

module.exports = router;
