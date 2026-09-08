/**
 * @swagger
 * /meta/platforms:
 *   get:
 *     tags: [Meta]
 *     summary: getPlatforms
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
 * /meta/languages:
 *   get:
 *     tags: [Meta]
 *     summary: getLanguages
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
const { getPlatforms, getLanguages } = require('../controllers/metaController');

router.get('/platforms', getPlatforms);
router.get('/languages', getLanguages);

module.exports = router;
