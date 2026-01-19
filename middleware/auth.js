const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;
  if (!token) return res.status(401).json({ msg: 'No token' });

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET || 'secret');

    // Handle both payload styles
    const userId = data.id || data.user?.id;

    if (!userId) {
      console.error('Auth middleware: token did not contain user id');
      return res.status(401).json({ msg: 'Invalid token payload' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(401).json({ msg: 'User not found' });

    req.user = user; // ✅ attach user here
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ msg: 'Token invalid' });
  }
};
