const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');

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
    
    // Attempting Port 465 as a last resort with very specific settings
    console.log(`📡 Final SMTP Attempt: ${cfg.smtp_host}:465`);

    try {
        const transporter = nodemailer.createTransport({
            host: cfg.smtp_host,
            port: 465,
            secure: true,
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            connectionTimeout: 10000, // Reduced timeout to fail faster if blocked
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

        console.log('✅ Success!');
        return { success: true, messageId: info.messageId };

    } catch (error) {
        let errorMsg = error.message;
        if (errorMsg.includes('timeout')) {
            errorMsg = "Railway Firewall is blocking Port 465/587. Please contact Railway Support or use a Web API like SendGrid/Mailgun.";
        }
        console.error('❌ SMTP Error:', errorMsg);
        return { success: false, error: errorMsg };
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
