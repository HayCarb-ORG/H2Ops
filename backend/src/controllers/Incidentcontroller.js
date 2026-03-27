const Incident = require("../models/Incident");

const formatIncident = (doc) => ({
  id: doc._id.toString(),
  title: doc.title,
  type: doc.type,
  sev: doc.severity,
  desc: doc.description,
  action: doc.action,
  status: doc.status,
  op: doc.operator,
  ts: doc.createdAt ? doc.createdAt.getTime() : Date.now(),
});

exports.getIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 });
    res.json(incidents.map(formatIncident));
  } catch (err) {
    console.error('Fetch incidents error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createIncident = async (req, res) => {
  try {
    const {
      title,
      type,
      severity,
      sev,
      description,
      desc,
      action,
      status,
      operator,
      op,
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ message: 'Title is required' });
    if (!type) return res.status(400).json({ message: 'Type is required' });

    const incident = new Incident({
      title: title.trim(),
      type,
      severity: severity || sev,
      description: description || desc,
      action,
      status: status || 'Open',
      operator: operator || op || req.user?.username,
    });

    await incident.save();
    res.status(201).json(formatIncident(incident));
  } catch (err) {
    console.error('Create incident error:', err);
    res.status(400).json({ message: 'Invalid data' });
  }
};

exports.updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: 'Status is required' });

    const incident = await Incident.findByIdAndUpdate(id, { status }, { new: true });
    if (!incident) return res.status(404).json({ message: 'Incident not found' });

    res.json(formatIncident(incident));
  } catch (err) {
    console.error('Update incident error:', err);
    res.status(400).json({ message: 'Invalid data' });
  }
};

exports.deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Incident.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Incident not found' });
    res.json({ message: 'Incident deleted' });
  } catch (err) {
    console.error('Delete incident error:', err);
    res.status(404).json({ message: 'Incident not found' });
  }
};