const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  plantType: String, // WTP, STP, ETP
  turbidity: Number,
  chlorine: Number,
  ph: Number,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Log", logSchema);