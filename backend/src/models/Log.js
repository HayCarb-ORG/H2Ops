// Log model for MongoDB (Mongoose)
const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  text: { type: String, required: true },
  operator: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Log', LogSchema);