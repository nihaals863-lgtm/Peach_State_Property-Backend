const pool = require('../config/db');

// @desc    Get all invoices
const getInvoices = async (req, res) => {
    try {
        let query = `SELECT i.*, t.full_name as tenant_name 
                     FROM invoices i 
                     LEFT JOIN tenants t ON i.tenant_id = t.id`;
        let params = [];
        if (req.user.role === 'manager') {
            query += ' WHERE i.added_by = ?';
            params.push(req.user.id);
        }
        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create Invoice
const createInvoice = async (req, res) => {
    const { invoice_number, tenant_id, lease_id, amount, due_date, status, type, paid_amount } = req.body;
    let pAmt = paid_amount || 0;
    const isPaid = (status || '').toLowerCase() === 'paid';
    if (isPaid && !paid_amount) pAmt = amount;
    const paid_date = isPaid ? new Date() : null;
    const invoiceType = type || 'Rent';
    try {
        const [result] = await pool.query(
            'INSERT INTO invoices (invoice_number, tenant_id, lease_id, amount, due_date, status, paid_date, type, paid_amount, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [invoice_number, tenant_id, lease_id, amount, due_date, status, paid_date, invoiceType, pAmt, req.user.id]
        );
        res.status(201).json({ success: true, data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Invoice Status
const updateInvoice = async (req, res) => {
    const { id } = req.params;
    const { status, paid_date, paid_amount } = req.body;
    try {
        let query = 'UPDATE invoices SET status=?, paid_date=?, paid_amount=? WHERE id=?';
        let params = [status, paid_date, paid_amount, id];
        if (req.user.role === 'manager') {
            query += ' AND added_by=?';
            params.push(req.user.id);
        }
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Invoice not found' });
        res.json({ success: true, message: 'Invoice updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Invoice
const deleteInvoice = async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? 'DELETE FROM invoices WHERE id=?' : 'DELETE FROM invoices WHERE id=? AND added_by=?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Invoice not found' });
        res.json({ success: true, message: 'Invoice deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getInvoices, createInvoice, updateInvoice, deleteInvoice };
