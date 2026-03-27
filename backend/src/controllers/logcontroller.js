const Log = require("../models/Log");

// CREATE LOG
exports.createLog = async (req, res) => {
  const log = await Log.create(req.body);
  res.json(log);
};

// GET ALL LOGS
exports.getLogs = async (req, res) => {
  const logs = await Log.find().sort({ createdAt: -1 });
  res.json(logs);
};