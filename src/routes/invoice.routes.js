const express = require('express');
const router = express.Router();
const { getInvoices, createInvoice, updateInvoice, deleteInvoice, sendInvoiceNotification } = require('../controllers/invoice.controller');
const { protect } = require('../middleware/auth');

router.route('/')
    .get(protect, getInvoices)
    .post(protect, createInvoice);

router.post('/:id/notify', protect, sendInvoiceNotification);

router.route('/:id')
    .put(protect, updateInvoice)
    .delete(protect, deleteInvoice);

module.exports = router;
