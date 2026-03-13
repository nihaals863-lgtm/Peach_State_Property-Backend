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
    
    // 🛡️ RE-FORCING STABLE PORT 465
    const port = 465;

    console.log(`📡 SMTP Direct Solve: ${cfg.smtp_host}:${port}`);

    try {
        const transporter = nodemailer.createTransport({
            host: cfg.smtp_host,
            port: port,
            secure: true,
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            // ✅ CRITICAL: Force IPv4 ONLY inside the transporter
            lookup: (hostname, options, callback) => {
                dns.lookup(hostname, { family: 4 }, (err, address, family) => {
                    callback(err, address, family);
                });
            },
            connectionTimeout: 20000,
            greetingTimeout: 20000,
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

        console.log('✅ Success: Email Sent on Railway');
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ SMTP Error Detail:', error.message);
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
