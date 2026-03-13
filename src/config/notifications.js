const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');
const dns = require('dns');

require('dotenv').config();

// Global IPv4 Force
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
        return {
            smtp_host: process.env.SMTP_HOST || 'smtp.hostinger.com',
            smtp_port: 465,
            smtp_user: process.env.SMTP_USER,
            smtp_pass: process.env.SMTP_PASS,
        };
    }
};

const sendEmail = async (to, subject, html) => {
    const cfg = await getConfig();
    
    // Always use Port 465 on Railway for Hostinger as it is the most reliable
    const port = 465; 
    const isSecure = true;

    console.log(`📡 SMTP Target: ${cfg.smtp_host}:${port} | User: ${cfg.smtp_user}`);

    try {
        const transporter = nodemailer.createTransport({
            host: cfg.smtp_host,
            port: port,
            secure: isSecure,
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            family: 4,
            connectionTimeout: 20000,
            greetingTimeout: 20000,
            socketTimeout: 45000,
            debug: true, // Show detailed logs in Railway
            logger: true,
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2'
            }
        });

        const info = await transporter.sendMail({
            from: `"Peach State Residences" <${cfg.smtp_user}>`,
            to,
            subject,
            html,
        });

        console.log('✅ Email Sent Successfully');
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Email Failed Detail:', error.message);
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
