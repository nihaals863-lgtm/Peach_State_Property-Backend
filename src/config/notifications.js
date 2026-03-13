const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');
const dns = require('dns');

require('dotenv').config();

const getConfig = async () => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
        const dbConfig = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
        return {
            smtp_host: (dbConfig.smtp_host && dbConfig.smtp_host.trim()) || process.env.SMTP_HOST || 'smtp.hostinger.com',
            smtp_user: (dbConfig.smtp_email && dbConfig.smtp_email.trim()) || process.env.SMTP_USER || '',
            smtp_pass: (dbConfig.smtp_pass && dbConfig.smtp_pass.trim()) || process.env.SMTP_PASS || '',
            twilio_sid: (dbConfig.twilio_sid && dbConfig.twilio_sid.trim()) || process.env.TWILIO_ACCOUNT_SID || '',
            twilio_token: (dbConfig.twilio_token && dbConfig.twilio_token.trim()) || process.env.TWILIO_AUTH_TOKEN || '',
            twilio_phone: (dbConfig.twilio_phone && dbConfig.twilio_phone.trim()) || process.env.TWILIO_PHONE_NUMBER || '',
        };
    } catch (e) {
        return { smtp_host: 'smtp.hostinger.com', smtp_user: process.env.SMTP_USER, smtp_pass: process.env.SMTP_PASS };
    }
};

const sendEmail = async (to, subject, html) => {
    const cfg = await getConfig();
    
    // 🚀 USE PORT 2525: Often open on Railway when 465/587 are blocked
    const port = 2525; 

    console.log(`📡 TRYING ALTERNATIVE PORT 2525: ${cfg.smtp_host}:${port}`);

    try {
        const transporter = nodemailer.createTransport({
            host: cfg.smtp_host,
            port: port,
            secure: false, // Must be false for 2525
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            // Force IPv4 lookup locally to avoid ENETUNREACH
            lookup: (hostname, options, callback) => {
                dns.resolve4(hostname, (err, addresses) => {
                    if (err || !addresses.length) return dns.lookup(hostname, options, callback);
                    callback(null, addresses[0], 4);
                });
            },
            connectionTimeout: 30000,
            socketTimeout: 30000,
            tls: {
                rejectUnauthorized: false
            }
        });

        const info = await transporter.sendMail({
            from: `"Peach State Residences" <${cfg.smtp_user}>`,
            to,
            subject,
            html,
        });

        console.log('✅ Email SUCCESS via Port 2525');
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Port 2525 Failed:', error.message);
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
