const Log = require("../models/Log");

const formatLog = (doc) => ({
  id: doc._id.toString(),
  text: doc.text,
  op: doc.operator,
  ts: doc.createdAt ? doc.createdAt.getTime() : Date.now(),
});

// GET ALL LOGS
exports.getLogs = async (req, res) => {
  try {
    const logs = await Log.find().sort({ createdAt: -1 });
    res.json(logs.map(formatLog));
  } catch (err) {
    console.error('Fetch logs error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// CREATE LOG
exports.createLog = async (req, res) => {
  try {
    const { text, operator, op } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Log text is required' });
    const operatorName = operator || op || req.user?.username;
    if (!operatorName) return res.status(400).json({ message: 'Operator is required' });

    const log = new Log({ text: text.trim(), operator: operatorName });
    await log.save();
    res.status(201).json(formatLog(log));
  } catch (err) {
    console.error('Create log error:', err);
    res.status(400).json({ message: 'Invalid data' });
  }
};

// DELETE LOG
exports.deleteLog = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Log.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Log not found' });
    res.json({ message: 'Log deleted' });
  } catch (err) {
    console.error('Delete log error:', err);
    res.status(404).json({ message: 'Log not found' });
  }
};