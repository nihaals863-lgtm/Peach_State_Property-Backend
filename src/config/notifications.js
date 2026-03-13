const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');

require('dotenv').config();

/**
 * Fetch dynamic config from DB with .env fallback
 */
const getConfig = async () => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
        const dbConfig = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

        // Build config with priority: Database -> .env -> defaults
        const cfg = {
            smtp_host: (dbConfig.smtp_host && dbConfig.smtp_host.trim()) || process.env.SMTP_HOST,
            smtp_port: parseInt((dbConfig.smtp_port && dbConfig.smtp_port.trim()) || process.env.SMTP_PORT || 587),
            smtp_user: (dbConfig.smtp_email && dbConfig.smtp_email.trim()) || process.env.SMTP_USER,
            smtp_pass: (dbConfig.smtp_pass && dbConfig.smtp_pass.trim()) || process.env.SMTP_PASS,
            twilio_sid: (dbConfig.twilio_sid && dbConfig.twilio_sid.trim()) || process.env.TWILIO_ACCOUNT_SID,
            twilio_token: (dbConfig.twilio_token && dbConfig.twilio_token.trim()) || process.env.TWILIO_AUTH_TOKEN,
            twilio_phone: (dbConfig.twilio_phone && dbConfig.twilio_phone.trim()) || process.env.TWILIO_PHONE_NUMBER,
        };

        return cfg;
    } catch (e) {
        console.error('Config fetch error, using .env fallback:', e.message);
        return {
            smtp_host: process.env.SMTP_HOST,
            smtp_port: parseInt(process.env.SMTP_PORT || 587),
            smtp_user: process.env.SMTP_USER,
            smtp_pass: process.env.SMTP_PASS,
            twilio_sid: process.env.TWILIO_ACCOUNT_SID,
            twilio_token: process.env.TWILIO_AUTH_TOKEN,
            twilio_phone: process.env.TWILIO_PHONE_NUMBER,
        };
    }
};

/**
 * Send Email Notification
 */
const sendEmail = async (to, subject, html) => {
    const cfg = await getConfig();
    
    // Safety check: Don't attempt to send if settings are missing
    if (!cfg.smtp_host || cfg.smtp_host === '127.0.0.1' || cfg.smtp_host === 'localhost') {
        console.error('❌ Email Error: Valid SMTP Host not configured (found: ' + cfg.smtp_host + ')');
        return { success: false, error: 'SMTP Host not configured correctly in Settings or .env' };
    }

    try {
        const isSecure = cfg.smtp_port === 465;
        const transporter = nodemailer.createTransport({
            host: cfg.smtp_host,
            port: cfg.smtp_port,
            secure: isSecure,
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            // Hostinger/Outlook often need this
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
        console.log('✅ Email sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send SMS Notification
 */
const sendSMS = async (to, body) => {
    const cfg = await getConfig();
    try {
        const client = twilio(cfg.twilio_sid, cfg.twilio_token);
        const message = await client.messages.create({
            body,
            from: cfg.twilio_phone,
            to,
        });
        console.log('SMS sent: %s', message.sid);
        return { success: true, sid: message.sid };
    } catch (error) {
        console.error('SMS Error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail, sendSMS };
