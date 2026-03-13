// ============================================================
// IMPORTANT: Force IPv4 FIRST before any other require/import
// This fixes ENETUNREACH errors on Railway (IPv6 disabled Cloud)
// ============================================================
const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
}

const app = require('./src/app');
const fs = require('fs');
const path = require('path');

// Ensure uploads folder exists (multer needs it to save files)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads/ directory');
}

// Using the port assigned by Railway OR local 5000
// Do not hardcode port 5000 ONLY, as Railway will crash
const PORT = process.env.PORT || 5000;

// Host must be '0.0.0.0' for Railway to bind the port properly externally
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode!`);
    console.log(`🌐 Live at: http://0.0.0.0:${PORT}`);
    console.log(`🌐 IPv4 DNS resolution is FORCED (Railway compatibility mode)`);
});
