const Incident = require("../models/Incident");

exports.createIncident = async (req, res) => {
  const incident = await Incident.create(req.body);
  res.json(incident);
};

exports.getIncidents = async (req, res) => {
  const incidents = await Incident.find().sort({ createdAt: -1 });
  res.json(incidents);
};