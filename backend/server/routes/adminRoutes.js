const express = require('express');
const router = express.Router();
const { banUser, unbanUser, makeEscrow, removeEscrow, banEscrow, changeUserRole, createAdSpace, listAdSpaces, listUsers, listEscrows, getStats, listAdminProducts, listChats, issuePhotoChangeCode, banIpAddress, unbanIpAddress, listBannedIps } = require('../controllers/adminController');
const { auth, requireRole } = require('../middleware/authMiddleware');

router.post('/ban/:id', auth, requireRole('escrow', 'admin'), banUser);
router.post('/unban/:id', auth, requireRole('admin'), unbanUser);
router.post('/make-escrow/:id', auth, requireRole('admin'), makeEscrow);
router.post('/remove-escrow/:id', auth, requireRole('admin'), removeEscrow);
router.post('/ban-escrow/:id', auth, requireRole('admin'), banEscrow);
router.post('/role/:id', auth, requireRole('admin'), express.json(), changeUserRole);
router.post('/users/:id/photo-change-code', auth, requireRole('admin'), express.json(), issuePhotoChangeCode);
router.post('/ads', auth, requireRole('admin'), express.json(), createAdSpace);
router.get('/ads', auth, requireRole('admin'), listAdSpaces);
router.get('/users', auth, requireRole('admin', 'escrow'), listUsers);
router.get('/escrows', auth, requireRole('admin'), listEscrows);
router.get('/stats', auth, requireRole('admin', 'escrow'), getStats);
router.get('/products', auth, requireRole('admin', 'escrow'), listAdminProducts);
router.get('/chats', auth, requireRole('admin', 'escrow'), listChats);
router.post('/ip-bans', auth, requireRole('admin'), express.json(), banIpAddress);
router.delete('/ip-bans', auth, requireRole('admin'), express.json(), unbanIpAddress);
router.get('/ip-bans', auth, requireRole('admin'), listBannedIps);

module.exports = router;
