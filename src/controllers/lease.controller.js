const pool = require('../config/db');

// @desc    Get all leases
const getLeases = async (req, res) => {
    try {
        let query = `SELECT l.*, t.full_name as tenant_name, p.name as property_name, u.name as added_by_name 
                     FROM leases l 
                     LEFT JOIN tenants t ON l.tenant_id = t.id 
                     LEFT JOIN properties p ON l.property_id = p.id
                     LEFT JOIN users u ON l.added_by = u.id`;
        let params = [];
        if (req.user.role === 'manager') {
            query += ' WHERE l.added_by = ?';
            params.push(req.user.id);
        }
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create Lease
const createLease = async (req, res) => {
    const { tenant_id, property_id, start_date, end_date, monthly_rent, security_deposit, status } = req.body;
    const file = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const [result] = await pool.query(
            'INSERT INTO leases (tenant_id, property_id, start_date, end_date, monthly_rent, security_deposit, status, agreement_file, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [tenant_id, property_id, start_date, end_date, monthly_rent, security_deposit, status, file, req.user.id]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Lease
const updateLease = async (req, res) => {
    const { id } = req.params;
    const { tenant_id, property_id, start_date, end_date, monthly_rent, security_deposit, status } = req.body;
    try {
        let query = 'UPDATE leases SET tenant_id=?, property_id=?, start_date=?, end_date=?, monthly_rent=?, security_deposit=?, status=? WHERE id=?';
        let params = [tenant_id, property_id, start_date, end_date, monthly_rent, security_deposit || 0, status, id];
        if (req.user.role === 'manager') {
            query += ' AND added_by=?';
            params.push(req.user.id);
        }
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Lease not found' });
        res.json({ success: true, message: 'Lease updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Lease
const deleteLease = async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? 'DELETE FROM leases WHERE id=?' : 'DELETE FROM leases WHERE id=? AND added_by=?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Lease not found' });
        res.json({ success: true, message: 'Lease deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getLeases, createLease, updateLease, deleteLease };
