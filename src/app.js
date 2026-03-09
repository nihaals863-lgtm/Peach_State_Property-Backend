const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('express-async-errors'); // Avoid unhandled promise rejection crashes
require('dotenv').config();

const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// ============================================
// 1. MIDDLEWARE 
// ============================================
app.use(helmet({ crossOriginResourcePolicy: false })); // allows sending images to frontend
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Logger

// CORS setup - IMPORTANT for Railway Frontend connection

// ============================================
// CORS SETUP
// ============================================

const allowedOrigins = [
  'http://localhost:3000', // local frontend
  'http://localhost:5173',
  'https://peach-state-property.wenbear.online',// vite
  process.env.FRONTEND_URL // production frontend
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","PATCH"],
  allowedHeaders: ["Content-Type","Authorization"]
}));


// Setup static file serving for Uploads
app.use('/uploads', express.static('uploads'));

// ============================================
// 2. ROOT ENDPOINT (Health Check)
// ============================================
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Peach State Residences API (v4.0)' });
});

// ============================================
// 3. API ROUTES
// ============================================
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/properties', require('./routes/property.routes'));
app.use('/api/tenants', require('./routes/tenant.routes'));
app.use('/api/leases', require('./routes/lease.routes'));
app.use('/api/invoices', require('./routes/invoice.routes'));
app.use('/api/maintenance', require('./routes/maintenance.routes'));
app.use('/api/expenses', require('./routes/expense.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/profile', require('./routes/profile.routes'));
app.use('/api/documents', require('./routes/document.routes'));

// ============================================
// 4. ERROR HANDLING
// ============================================
app.use(notFound);       // Catches 404s
app.use(errorHandler);   // Catches everything else without crashing server

module.exports = app;
