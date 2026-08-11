const express = require('express');
const router = express.Router();
const { buyProduct, listTransactions, pendingTransactions, confirmTransaction, getTransaction, setTransactionStage, assignEscrow } = require('../controllers/transactionController');
const { auth } = require('../middleware/authMiddleware');

router.post('/products/:id/buy', auth, buyProduct);
router.get('/', auth, listTransactions);
router.get('/pending', auth, pendingTransactions);
router.get('/:id', auth, getTransaction);
router.post('/:id/confirm', auth, confirmTransaction);
router.post('/:id/stage', auth, express.json(), setTransactionStage);
router.post('/:id/assign-escrow', auth, express.json(), assignEscrow);

module.exports = router;
