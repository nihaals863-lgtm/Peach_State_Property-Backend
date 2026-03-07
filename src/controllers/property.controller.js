const pool = require('../config/db');

// @desc    Get all properties
const getProperties = async (req, res) => {
    const { id: userId, role } = req.user;
    try {
        let query = `SELECT p.*, u.name as added_by_name FROM properties p 
                     LEFT JOIN users u ON p.added_by = u.id`;
        let params = [];
        if (role === 'manager') {
            query += ' WHERE p.added_by = ?';
            params.push(userId);
        }
        query += ' ORDER BY p.created_at DESC';
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add Property
const createProperty = async (req, res) => {
    const { name, address, city, type, total_units, status } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const [result] = await pool.query(
            'INSERT INTO properties (name, address, city, type, total_units, status, image, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, address, city, type, total_units, status, image, req.user.id]
        );
        await pool.query('INSERT INTO activity_logs (action, details, user_id) VALUES (?, ?, ?)',
            ['Create Property', `Added property: ${name}`, req.user.id]);
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Property
const updateProperty = async (req, res) => {
    const { id } = req.params;
    const { name, address, city, type, total_units, status } = req.body;
    try {
        let query = 'UPDATE properties SET name=?, address=?, city=?, type=?, total_units=?, status=?';
        let params = [name, address, city, type, total_units, status];
        if (req.file) {
            query += ', image=?';
            params.push(`/uploads/${req.file.filename}`);
        }
        query += ' WHERE id=?';
        params.push(id);
        if (req.user.role === 'manager') {
            query += ' AND added_by=?';
            params.push(req.user.id);
        }
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Property not found' });
        res.json({ success: true, message: 'Property updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Property
const deleteProperty = async (req, res) => {
    try {
        const query = req.user.role === 'admin'
            ? 'DELETE FROM properties WHERE id=?'
            : 'DELETE FROM properties WHERE id=? AND added_by=?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Property not found' });
        res.json({ success: true, message: 'Property deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getProperties, createProperty, updateProperty, deleteProperty };
