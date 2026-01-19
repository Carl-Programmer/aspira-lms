const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const auth = require('../middleware/auth');


// ============================
// REGISTER (students only)
// ============================
router.post('/register', async (req, res) => {
  try {
    const { firstname, lastname, email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ msg: 'Email and password required' });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ msg: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const u = new User({
      firstname,
      lastname,
      email,
      password: hash,
      role: 'student',
    });
    await u.save();

    const token = jwt.sign({ id: u._id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: {
        id: u._id,
        firstname: u.firstname,
        lastname: u.lastname,
        role: u.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ============================
// LOGIN
// ============================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const u = await User.findOne({ email });
    if (!u) return res.status(400).json({ msg: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ id: u._id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: {
        id: u._id,
        firstname: u.firstname,
        lastname: u.lastname,
        role: u.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ============================
// FORGOT PASSWORD
// ============================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ msg: 'No account found with this email.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpire = Date.now() + 1000 * 60 * 10; // 10 mins
    await user.save();

    const resetLink = `http://localhost:3000/reset-password.html?token=${token}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'emailsender.888xyz@gmail.com',       // 🔹 replace with your Gmail
        pass: 'qpwx lrsf zlfw fjux',    // 🔹 use App Password (not normal password)
      },
    });

    await transporter.sendMail({
      from: 'Aspira <youremail@gmail.com>',
      to: email,
      subject: 'Aspira Password Reset Request',
      html: `
        <p>Click the link below to reset your password (expires in 10 minutes):</p>
        <a href="${resetLink}" target="_blank">${resetLink}</a>
      `,
    });

    res.json({ msg: 'Password reset link sent to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error sending reset email.' });
  }
});

// ============================
// RESET PASSWORD
// ============================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpire: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ msg: 'Invalid or expired reset token.' });

    // ✅ Hash new password before saving
    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;

    // clear reset token data
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();

    res.json({ msg: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error resetting password.' });
  }
});

// ✅ Get current logged-in user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('❌ Error fetching /me:', err);
    res.status(500).json({ msg: 'Server error fetching current user' });
  }
});


module.exports = router;
