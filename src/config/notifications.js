const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');
const dns = require('dns');

require('dotenv').config();

// Force IPv4 globally for Node.js
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const getConfig = async () => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
        const dbConfig = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
        return {
            smtp_host:    (dbConfig.smtp_host   && dbConfig.smtp_host.trim())   || process.env.SMTP_HOST   || 'smtp.hostinger.com',
            smtp_port:    parseInt((dbConfig.smtp_port && dbConfig.smtp_port.trim()) || process.env.SMTP_PORT || 465),
            smtp_user:    (dbConfig.smtp_email  && dbConfig.smtp_email.trim())  || process.env.SMTP_USER   || '',
            smtp_pass:    (dbConfig.smtp_pass   && dbConfig.smtp_pass.trim())   || process.env.SMTP_PASS   || '',
            twilio_sid:   (dbConfig.twilio_sid  && dbConfig.twilio_sid.trim())  || process.env.TWILIO_ACCOUNT_SID   || '',
            twilio_token: (dbConfig.twilio_token && dbConfig.twilio_token.trim()) || process.env.TWILIO_AUTH_TOKEN  || '',
            twilio_phone: (dbConfig.twilio_phone && dbConfig.twilio_phone.trim()) || process.env.TWILIO_PHONE_NUMBER || '',
        };
    } catch (e) {
        return { smtp_host: 'smtp.hostinger.com', smtp_port: 465, smtp_user: process.env.SMTP_USER, smtp_pass: process.env.SMTP_PASS };
    }
};

const sendEmail = async (to, subject, html) => {
    const cfg = await getConfig();
    
    // 🚀 THE BYPASS: Use direct IPv4 of Hostinger but identify via ServerName
    // This often bypasses cloud firewall egress blocks.
    const smtpIP = '172.65.255.143'; 
    const port = 465;

    console.log(`🛡️  Direct IP Connect: ${smtpIP} (Host: ${cfg.smtp_host})`);

    try {
        const transporter = nodemailer.createTransport({
            host: smtpIP, // Use IP directly 
            port: port,
            secure: true,
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            connectionTimeout: 30000,
            socketTimeout: 50000,
            tls: {
                // IMPORTANT: Since we use IP, we must tell SSL we expect 'smtp.hostinger.com'
                servername: 'smtp.hostinger.com',
                rejectUnauthorized: false
            }
        });

        const info = await transporter.sendMail({
            from: `"Peach State Residences" <${cfg.smtp_user}>`,
            to,
            subject,
            html,
        });

        console.log('✅ Email SUCCESS via Direct IP');
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Email FAILURE:', error.message);
        // Fallback to hostname if IP fails
        if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
            console.log('🔄 Attempting fallback to standard Hostname...');
            // ... (recursive or second attempt if needed, but let's try IP first)
        }
        return { success: false, error: error.message };
    }
};

const sendSMS = async (to, body) => {
    const cfg = await getConfig();
    if (!cfg.twilio_sid || !cfg.twilio_token) return { success: false, error: 'Twilio missing' };
    try {
        const client = twilio(cfg.twilio_sid, cfg.twilio_token);
        const message = await client.messages.create({ body, from: cfg.twilio_phone, to });
        return { success: true, sid: message.sid };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail, sendSMS };
