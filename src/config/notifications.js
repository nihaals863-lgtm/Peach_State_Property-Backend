const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');

require('dotenv').config();

const getConfig = async () => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
        const dbConfig = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
        return {
            smtp_user: (dbConfig.smtp_email && dbConfig.smtp_email.trim()) || process.env.SMTP_USER || '',
            smtp_pass: (dbConfig.smtp_pass && dbConfig.smtp_pass.trim()) || process.env.SMTP_PASS || '',
            twilio_sid: (dbConfig.twilio_sid && dbConfig.twilio_sid.trim()) || process.env.TWILIO_ACCOUNT_SID || '',
            twilio_token: (dbConfig.twilio_token && dbConfig.twilio_token.trim()) || process.env.TWILIO_AUTH_TOKEN || '',
            twilio_phone: (dbConfig.twilio_phone && dbConfig.twilio_phone.trim()) || process.env.TWILIO_PHONE_NUMBER || '',
        };
    } catch (e) {
        return { smtp_user: process.env.SMTP_USER, smtp_pass: process.env.SMTP_PASS };
    }
};

const sendEmail = async (to, subject, html) => {
    const cfg = await getConfig();
    
    // 🛡️ ULTIMATE HARDCODE: Use direct IP 172.65.255.143 and Port 465
    // This bypasses ALL Railway DNS and IPv6 issues.
    const smtpIP = '172.65.255.143'; 
    const port = 465;

    console.log(`📡 FORCING CONNECTION: ${smtpIP}:${port} | User: ${cfg.smtp_user}`);

    try {
        const transporter = nodemailer.createTransport({
            host: smtpIP,
            port: port,
            secure: true,
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            connectionTimeout: 60000, // 60s timeout for stability
            greetingTimeout: 60000,
            socketTimeout: 60000,
            tls: {
                servername: 'smtp.hostinger.com', // Needed for SSL to match Hostinger's cert
                rejectUnauthorized: false
            }
        });

        const info = await transporter.sendMail({
            from: `"Peach State Residences" <${cfg.smtp_user}>`,
            to,
            subject,
            html,
        });

        console.log('✅ Email SUCCESS via Direct IP and SSL 465');
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ SMTP FAILURE:', error.message);
        return { success: false, error: error.message };
    }
};

const sendSMS = async (to, body) => {
    const cfg = await getConfig();
    try {
        const client = twilio(cfg.twilio_sid, cfg.twilio_token);
        const message = await client.messages.create({ body, from: cfg.twilio_phone, to });
        return { success: true, sid: message.sid };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail, sendSMS };
