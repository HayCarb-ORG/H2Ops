// Log routes
const express = require('express');
const router = express.Router();
const logController = require('../controllers/logcontroller');

router.get('/', logController.getLogs);
router.post('/', logController.createLog);
router.delete('/:id', logController.deleteLog);

module.exports = router;
