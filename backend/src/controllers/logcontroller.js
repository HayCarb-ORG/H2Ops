const Log = require("../models/Log");

// GET ALL LOGS
exports.getLogs = async (req, res) => {
  try {
    const logs = await Log.find().sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// CREATE LOG
exports.createLog = async (req, res) => {
  try {
    const { text, operator } = req.body;
    const log = new Log({ text, operator });
    await log.save();
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ message: 'Invalid data' });
  }
};

// DELETE LOG
exports.deleteLog = async (req, res) => {
  try {
    const { id } = req.params;
    await Log.findByIdAndDelete(id);
    res.json({ message: 'Log deleted' });
  } catch (err) {
    res.status(404).json({ message: 'Log not found' });
  }
};