const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema({
  title: String,
  severity: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
  },
  description: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Incident", incidentSchema);