const express = require('express');
const {
  subscribe,
  unsubscribe
} = require('../controllers/newsletterController');

const router = express.Router();

router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

module.exports = router;