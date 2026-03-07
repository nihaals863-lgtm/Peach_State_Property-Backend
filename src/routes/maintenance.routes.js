const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getMaintenance, createMaintenance, updateMaintenance, deleteMaintenance } = require('../controllers/maintenance.controller');
const { protect } = require('../middleware/auth');

router.route('/')
    .get(protect, getMaintenance)
    .post(protect, createMaintenance);

router.route('/:id')
    .put(protect, updateMaintenance)
    .delete(protect, deleteMaintenance);

// Metadata (Dynamic Categories)
router.get('/meta/categories', protect, async (req, res) => {
    const [cats] = await pool.query('SELECT * FROM maintenance_categories ORDER BY name ASC');
    res.json({ success: true, data: cats });
});

router.post('/meta/categories', protect, async (req, res) => {
    const { name } = req.body;
    await pool.query('INSERT IGNORE INTO maintenance_categories (name) VALUES (?)', [name]);
    res.json({ success: true, message: 'Category added' });
});

module.exports = router;
