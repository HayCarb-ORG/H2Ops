// Incident model for MongoDB (Mongoose)
const mongoose = require('mongoose');

const IncidentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, required: true },
  severity: { type: String, required: true },
  description: { type: String, required: true },
  action: { type: String, required: true },
  status: { type: String, required: true },
  operator: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Incident', IncidentSchema);