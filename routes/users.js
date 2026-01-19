const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');

// ===== File upload setup =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/profile/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ===== Current user =====
router.get('/me', auth, async (req, res) => res.json(req.user));

// ===== Update own profile =====
router.put('/me', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    const updates = req.body;
    if (req.file) updates.profilePicture = '/uploads/profile/' + req.file.filename;
    const u = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json(u);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ===== List or Search Users =====
router.get('/', auth, async (req, res) => {
  try {
    const { email } = req.query;

    // ✅ Teachers or Admins can search by email
    if (email) {
      if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
        return res.status(403).json({ msg: 'Forbidden: Only teachers or admins can search users by email' });
      }

      const filter = { email: new RegExp(email, 'i') };
      const users = await User.find(filter).select('-password');
      return res.json(users);
    }

    // ✅ Only Admins can list all users (no ?email)
    if (req.user.role !== 'admin')
      return res.status(403).json({ msg: 'Forbidden: Admin only' });

    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error('❌ Error fetching users:', err);
    res.status(500).json({ msg: 'Server error fetching users' });
  }
});

// ===== Admin: promote user to teacher =====
router.post('/:id/promote', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ msg: 'Not found' });
  user.role = 'teacher';
  await user.save();
  res.json({ msg: 'Promoted', user });
});

// ===== Admin: demote user to student =====
router.post('/:id/demote', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ msg: 'Not found' });
  user.role = 'student';
  await user.save();
  res.json({ msg: 'Demoted', user });
});

// ===== Admin: add a new user =====
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });
  try {
    const { firstname, lastname, email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: 'Email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'Email already exists' });

    // ✅ Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstname,
      lastname,
      email,
      password: hashedPassword,
      role: role || 'student'
    });

    await newUser.save();
    res.json({ msg: 'User created successfully', user: newUser });
  } catch (err) {
    console.error('❌ Error creating user:', err);
    res.status(500).json({ msg: 'Server error while creating user' });
  }
});

// ===== Admin: edit existing user =====
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });
  try {
    const updates = req.body;
if (!updates.password) delete updates.password; // prevent overwriting with blank
const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');

    if (!updated) return res.status(404).json({ msg: 'User not found' });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});
// ===== Admin: delete user =====
router.delete('/:id', require('../middleware/auth'), async (req, res) => {
  console.log('Delete route reached for', req.params.id);
  if (!req.user) return res.status(401).json({ msg: 'No user attached' });
  if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });

  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'User deleted', deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});


console.log('[Users routes] file loaded');


module.exports = router;
