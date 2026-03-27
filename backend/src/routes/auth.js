
// Auth routes
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Register new user (admin only, or for initial setup)
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required' });

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: 'User already exists' });

    const user = new User({ username, password });
    await user.save();

    res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) return res.status(409).json({ message: 'User already exists' });

    const payload = { message: 'Server error' };
    if (process.env.NODE_ENV !== 'production') payload.details = err.message;
    res.status(500).json(payload);
  }
});

router.post('/login', authController.login);

module.exports = router;
