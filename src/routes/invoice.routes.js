const express = require('express');
const router = express.Router();
const { getInvoices, createInvoice, updateInvoice, deleteInvoice } = require('../controllers/invoice.controller');
const { protect } = require('../middleware/auth');

router.route('/')
    .get(protect, getInvoices)
    .post(protect, createInvoice);

router.route('/:id')
    .put(protect, updateInvoice)
    .delete(protect, deleteInvoice);

module.exports = router;
