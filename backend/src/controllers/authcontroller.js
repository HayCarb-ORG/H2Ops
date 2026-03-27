const User = require("../models/User");
const jwt = require("jsonwebtoken");

// LOGIN
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    const payload = { message: 'Server error' };
    if (process.env.NODE_ENV !== 'production') payload.details = err.message;
    res.status(500).json(payload);
  }
};