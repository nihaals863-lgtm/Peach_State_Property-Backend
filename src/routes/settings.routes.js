const express = require('express');
const router = express.Router();
const { getUsers, updateUser, deleteUser, getIntegrations, updateIntegrations } = require('../controllers/settings.controller');
const { protect, adminOnly } = require('../middleware/auth');

// User Management (Admin Only)
router.route('/users')
    .get(protect, adminOnly, getUsers);

router.route('/users/:id')
    .put(protect, adminOnly, updateUser)
    .delete(protect, adminOnly, deleteUser);

// Cloud Integrations (Admin Only)
router.route('/integrations')
    .get(protect, adminOnly, getIntegrations)
    .post(protect, adminOnly, updateIntegrations);

module.exports = router;
