const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');
const dns = require('dns');

require('dotenv').config();

/**
 * Fetch dynamic config from DB with .env fallback
 */
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

/**
 * Send Email Notification
 * Optimized for Railway + Hostinger
 */
const sendEmail = async (to, subject, html) => {
    const cfg = await getConfig();
    
    // 🚀 STABLE PORT for Hostinger: 465 (SSL)
    const port = 465; 

    console.log(`📡 SMTP Connect Attempt: ${cfg.smtp_host}:${port}`);

    try {
        const transporter = nodemailer.createTransport({
            host: cfg.smtp_host,
            port: port,
            secure: true, // true for 465
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            // Force IPv4 lookup locally in the transporter
            lookup: (hostname, options, callback) => {
                dns.resolve4(hostname, (err, addresses) => {
                    if (err || !addresses.length) {
                        return dns.lookup(hostname, options, callback);
                    }
                    callback(null, addresses[0], 4);
                });
            },
            // High reliability settings
            connectionTimeout: 30000, // 30s
            greetingTimeout: 30000,
            socketTimeout: 60000,
            pool: true, // Use pooling for better connection management
            tls: {
                // This tells the server who we are, bypassing some filters
                servername: cfg.smtp_host,
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

        console.log('✅ Email Sent successfully!');
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ SMTP Error:', error.message);
        return { success: false, error: error.message };
    }
};

const sendSMS = async (to, body) => {
    const cfg = await getConfig();
    if (!cfg.twilio_sid || !cfg.twilio_token) return { success: false, error: 'Twilio setup missing' };
    try {
        const client = twilio(cfg.twilio_sid, cfg.twilio_token);
        const message = await client.messages.create({ body, from: cfg.twilio_phone, to });
        return { success: true, sid: message.sid };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail, sendSMS };
