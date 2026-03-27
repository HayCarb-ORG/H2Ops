const Incident = require("../models/Incident");

exports.getIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 });
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createIncident = async (req, res) => {
  try {
    const { title, type, severity, description, action, status, operator } = req.body;
    const incident = new Incident({ title, type, severity, description, action, status, operator });
    await incident.save();
    res.status(201).json(incident);
  } catch (err) {
    res.status(400).json({ message: 'Invalid data' });
  }
};

exports.deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    await Incident.findByIdAndDelete(id);
    res.json({ message: 'Incident deleted' });
  } catch (err) {
    res.status(404).json({ message: 'Incident not found' });
  }
};