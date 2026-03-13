const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');
const dns = require('dns');

require('dotenv').config();

// Forces IPv4 globally
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

/**
 * Fetch dynamic config from DB with .env fallback
 */
const getConfig = async () => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
        const dbConfig = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

        const cfg = {
            smtp_host:    (dbConfig.smtp_host   && dbConfig.smtp_host.trim())   || process.env.SMTP_HOST   || 'smtp.hostinger.com',
            smtp_port:    parseInt((dbConfig.smtp_port && dbConfig.smtp_port.trim()) || process.env.SMTP_PORT || 465),
            smtp_user:    (dbConfig.smtp_email  && dbConfig.smtp_email.trim())  || process.env.SMTP_USER   || '',
            smtp_pass:    (dbConfig.smtp_pass   && dbConfig.smtp_pass.trim())   || process.env.SMTP_PASS   || '',
            twilio_sid:   (dbConfig.twilio_sid  && dbConfig.twilio_sid.trim())  || process.env.TWILIO_ACCOUNT_SID   || '',
            twilio_token: (dbConfig.twilio_token && dbConfig.twilio_token.trim()) || process.env.TWILIO_AUTH_TOKEN  || '',
            twilio_phone: (dbConfig.twilio_phone && dbConfig.twilio_phone.trim()) || process.env.TWILIO_PHONE_NUMBER || '',
        };

        console.log(`📧 SMTP Source: ${dbConfig.smtp_host ? 'Database' : '.env'} | Host: ${cfg.smtp_host} | Port: ${cfg.smtp_port}`);
        return cfg;

    } catch (e) {
        console.error('⚠️  Config fetch error:', e.message);
        return {
            smtp_host:    process.env.SMTP_HOST    || 'smtp.hostinger.com',
            smtp_port:    parseInt(process.env.SMTP_PORT || 465),
            smtp_user:    process.env.SMTP_USER    || '',
            smtp_pass:    process.env.SMTP_PASS    || '',
            twilio_sid:   process.env.TWILIO_ACCOUNT_SID   || '',
            twilio_token: process.env.TWILIO_AUTH_TOKEN    || '',
            twilio_phone: process.env.TWILIO_PHONE_NUMBER  || '',
        };
    }
};

/**
 * Send Email Notification
 * Logic: Try Secure Port 465 FIRST as it is standard for Hostinger.
 */
const sendEmail = async (to, subject, html) => {
    const cfg = await getConfig();

    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
        return { success: false, error: 'SMTP Credentials missing' };
    }

    // Force Port 465 if we are on Railway and getting timeouts on 587
    // Many cloud providers block 587/2525 but allow 465
    const finalPort = (cfg.smtp_port === 587 || cfg.smtp_port === 2525) ? 465 : cfg.smtp_port;
    const isSecure = finalPort === 465;

    console.log(`📡 SMTP Connect: ${cfg.smtp_host}:${finalPort} | Secure: ${isSecure}`);

    try {
        const transporter = nodemailer.createTransport({
            host: cfg.smtp_host,
            port: finalPort,
            secure: isSecure,
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            family: 4, // Force IPv4
            connectionTimeout: 15000,
            greetingTimeout: 15000,
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

        console.log('✅ Email Sent:', info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Email Failed:', error.message);
        return { success: false, error: error.message };
    }
};

const sendSMS = async (to, body) => {
    const cfg = await getConfig();
    if (!cfg.twilio_sid || !cfg.twilio_token) return { success: false, error: 'Twilio config missing' };
    try {
        const client = twilio(cfg.twilio_sid, cfg.twilio_token);
        const message = await client.messages.create({ body, from: cfg.twilio_phone, to });
        console.log('✅ SMS Sent:', message.sid);
        return { success: true, sid: message.sid };
    } catch (error) {
        console.error('❌ SMS Failed:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail, sendSMS };
