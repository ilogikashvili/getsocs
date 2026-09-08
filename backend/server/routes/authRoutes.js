const express = require('express');
const router = express.Router();
const { register, login, verifyTwoFactor, me, verifyEmail, resendVerificationCode, verifyUser, verifyBuyer, getVerificationStatus, updatePrivacy, getProfilePublic, uploadProfilePhotos, unlockProfilePhotoChange, requestPasswordReset, resetPassword, changePassword, updateProfile, postReview, getReviews, getDashboardReviews } = require('../controllers/authController');
const { upload } = require('../middleware/uploadMiddleware');
const { validateAndNormalizeImages } = require('../middleware/imageDimensionMiddleware');
const { auth } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               idImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Registration failed
 */
router.post('/register', upload.single('idImage'), register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns token
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', express.json(), login);
router.post('/login/verify-2fa', express.json(), verifyTwoFactor);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Send or resend the email verification code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: Verification code sent successfully
 *       400:
 *         description: Invalid request or already verified
 */
router.post('/verify-email', express.json(), resendVerificationCode);

/**
 * @swagger
 * /auth/verify-email/code:
 *   post:
 *     summary: Verify email using the verification code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *             required:
 *               - email
 *               - code
 *     responses:
 *       200:
 *         description: Email successfully verified
 *       400:
 *         description: Invalid code or expired code
 */
router.post('/verify-email/code', express.json(), verifyEmail);

router.post('/password/request', express.json(), requestPasswordReset);
router.post('/password/reset', express.json(), resetPassword);
router.post('/password/change', auth, express.json(), changePassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *       401:
 *         description: Unauthorized
 */
router.get('/me', auth, me);
router.post('/verify-user', auth, express.json(), verifyUser);
router.post('/verify-buyer', auth, express.json(), verifyBuyer);
router.get('/verification-status/:userId', auth, getVerificationStatus);
router.post('/profile/privacy', auth, express.json(), updatePrivacy);
router.get('/profile/:userId', auth, getProfilePublic);
router.post('/profile/photos', auth, upload.fields([{ name: 'profilePhoto', maxCount: 1 }, { name: 'backgroundPhoto', maxCount: 1 }]), validateAndNormalizeImages, uploadProfilePhotos);
router.post('/profile/photos/unlock', auth, express.json(), unlockProfilePhotoChange);
router.post('/profile/update', auth, express.json(), updateProfile);
router.post('/reviews', auth, express.json(), postReview);
router.get('/reviews/dashboard/summary', getDashboardReviews);
router.get('/reviews/:userId', auth, getReviews);

module.exports = router;
