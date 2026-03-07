const express = require('express');
const router = express.Router();
const { updateProfile } = require('../controllers/profile.controller');
const { protect } = require('../middleware/auth');

router.put('/', protect, updateProfile);

module.exports = router;
