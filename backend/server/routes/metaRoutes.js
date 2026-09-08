const express = require('express');
const router = express.Router();
const { getPlatforms, getLanguages } = require('../controllers/metaController');

router.get('/platforms', getPlatforms);
router.get('/languages', getLanguages);

module.exports = router;
