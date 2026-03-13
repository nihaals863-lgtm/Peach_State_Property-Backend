const nodemailer = require('nodemailer');
const twilio = require('twilio');
const pool = require('./db');

require('dotenv').config();
const dns = require('dns'); // Added for custom lookup


// NOTE: IPv4 is forced globally in server.js (dns.setDefaultResultOrder)
// The family:4 below is an extra safety layer specifically for nodemailer

/**
 * Fetch dynamic config from DB with .env fallback
 * Priority: Database value -> Env variable -> default
 */
const getConfig = async () => {
    try {
        const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
        const dbConfig = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});

        const cfg = {
            smtp_host:    (dbConfig.smtp_host   && dbConfig.smtp_host.trim())   || process.env.SMTP_HOST   || '',
            smtp_port:    parseInt((dbConfig.smtp_port && dbConfig.smtp_port.trim()) || process.env.SMTP_PORT || 587),
            smtp_user:    (dbConfig.smtp_email  && dbConfig.smtp_email.trim())  || process.env.SMTP_USER   || '',
            smtp_pass:    (dbConfig.smtp_pass   && dbConfig.smtp_pass.trim())   || process.env.SMTP_PASS   || '',
            twilio_sid:   (dbConfig.twilio_sid  && dbConfig.twilio_sid.trim())  || process.env.TWILIO_ACCOUNT_SID   || '',
            twilio_token: (dbConfig.twilio_token && dbConfig.twilio_token.trim()) || process.env.TWILIO_AUTH_TOKEN  || '',
            twilio_phone: (dbConfig.twilio_phone && dbConfig.twilio_phone.trim()) || process.env.TWILIO_PHONE_NUMBER || '',
        };

        console.log(`📧 SMTP Source: ${dbConfig.smtp_host ? 'Database' : '.env'} | Host: ${cfg.smtp_host} | Port: ${cfg.smtp_port} | User: ${cfg.smtp_user}`);

        return cfg;

    } catch (e) {
        console.error('⚠️  Config fetch error, falling back to .env:', e.message);
        return {
            smtp_host:    process.env.SMTP_HOST    || '',
            smtp_port:    parseInt(process.env.SMTP_PORT || 587),
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
 * Uses port 587 + STARTTLS (works on Railway / most cloud providers)
 * Port 465 is often blocked by cloud firewall egress rules
 */
const sendEmail = async (to, subject, html) => {
    const cfg = await getConfig();

    // Validate SMTP config before attempting connection
    if (!cfg.smtp_host || cfg.smtp_host === '127.0.0.1' || cfg.smtp_host === 'localhost') {
        const msg = `SMTP Host not configured correctly. Found: "${cfg.smtp_host}"`;
        console.error('❌ Email blocked:', msg);
        return { success: false, error: msg };
    }

    if (!cfg.smtp_user || !cfg.smtp_pass) {
        const msg = 'SMTP User or Password is missing in settings.';
        console.error('❌ Email blocked:', msg);
        return { success: false, error: msg };
    }

    try {
        // Port 465 = secure SSL (often blocked on cloud)
        // Port 587 = STARTTLS (recommended for cloud / Railway)
        // We auto-switch: if port is 465, use secure=true, else secure=false + STARTTLS
        const isSecure = cfg.smtp_port === 465;
        const smtpHost = cfg.smtp_host;

        console.log(`📡 Connecting SMTP: ${smtpHost}:${cfg.smtp_port} | alternative: 2525 | secure=${isSecure}`);

        const transporter = nodemailer.createTransport({
            host:   smtpHost,
            port:   cfg.smtp_port === 587 ? 2525 : cfg.smtp_port, // 🚀 TRY 2525 if 587 fails
            secure: isSecure,
            auth: {
                user: cfg.smtp_user,
                pass: cfg.smtp_pass,
            },
            name: 'peach-state-property.wenbear.online', // Identify as the legitimate domain
            // ✅ KEY FIX: Force IPv4 - prevents ENETUNREACH on Railway
            family: 4,
            // Timeouts
            connectionTimeout: 20000,
            greetingTimeout:   20000,
            socketTimeout:     30000,
            tls: {
                rejectUnauthorized: false, // Required for many shared hosts
            },
            // ✅ AGGRESSIVE IPv4 FIX: Strictly ignore any IPv6 results
            lookup: (hostname, options, callback) => {
                dns.lookup(hostname, { family: 4 }, (err, address, family) => {
                    callback(err, address, family);
                });
            },
        });

        const info = await transporter.sendMail({
            from:    `"Peach State Residences" <${cfg.smtp_user}>`,
            to,
            subject,
            html,
        });

        console.log('✅ Email sent successfully! Message ID:', info.messageId);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Email Error:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Send SMS Notification via Twilio
 */
const sendSMS = async (to, body) => {
    const cfg = await getConfig();

    // Validate Twilio config before attempting
    if (!cfg.twilio_sid || !cfg.twilio_token || !cfg.twilio_phone) {
        const msg = 'Twilio credentials are not configured (SID, Token, or Phone missing).';
        console.error('❌ SMS blocked:', msg);
        return { success: false, error: msg };
    }

    try {
        const client = twilio(cfg.twilio_sid, cfg.twilio_token);
        const message = await client.messages.create({
            body,
            from: cfg.twilio_phone,
            to,
        });
        console.log('✅ SMS sent successfully! SID:', message.sid);
        return { success: true, sid: message.sid };

    } catch (error) {
        console.error('❌ SMS Error:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail, sendSMS };
