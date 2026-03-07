const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// @desc    Update user profile
const updateProfile = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        let sql = 'UPDATE users SET name=?, email=?';
        let params = [name, email];

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            sql += ', password=?';
            params.push(hashedPassword);
        }

        sql += ' WHERE id=?';
        params.push(req.user.id);

        await pool.query(sql, params);
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { updateProfile };
