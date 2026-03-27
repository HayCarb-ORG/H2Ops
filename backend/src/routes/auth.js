
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

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed });
    await user.save();

    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', authController.login);

module.exports = router;
