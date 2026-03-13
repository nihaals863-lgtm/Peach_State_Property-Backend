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
    
    // 🛡️ FINAL STABILITY CONFIG: Port 465 (Direct SSL)
    // Using direct IPv4 to bypass Railway's broken IPv6 DNS resolution
    const smtpIP = '172.65.255.143'; 
    const port = 465;

    console.log(`📡 SMTP Connect: ${smtpIP}:465 (SSL) | User: ${cfg.smtp_user}`);

    try {
        const transporter = nodemailer.createTransport({
            host: smtpIP,
            port: port,
            secure: true, // TRUE for 465 (SSL/TLS)
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            connectionTimeout: 40000, // 40 seconds
            greetingTimeout: 40000,
            socketTimeout: 60000,
            tls: {
                // IMPORTANT: Match certificate with hostinger hostname
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

        console.log('✅ Success: Email Sent on Railway via Port 465');
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Final Error Try:', error.message);
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
