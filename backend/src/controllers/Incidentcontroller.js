const {
  incidentsCollection,
  FieldValue,
  toMillis,
} = require("../utils/firestoreCollections");

const formatIncident = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || "",
    type: data.type || "",
    severity: data.severity || data.sev || "Low",
    description: data.description || data.desc || "",
    action: data.action || "",
    status: data.status || "Open",
    owner: data.operator || data.op || "",
    timestamp: toMillis(data.createdAt),
  };
};

exports.getIncidents = async (req, res) => {
  try {
    const snapshot = await incidentsCollection.orderBy("createdAt", "desc").get();
    res.json(snapshot.docs.map(formatIncident));
  } catch (err) {
    console.error("Fetch incidents error:", err);
    res.status(500).json({ message: "Server error" });
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

    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
    if (!type) return res.status(400).json({ message: "Type is required" });

    const docRef = await incidentsCollection.add({
      title: title.trim(),
      type,
      severity: severity || sev || "Low",
      description: (description || desc || "").trim(),
      action: action?.trim() || "",
      status: status || "Open",
      operator: operator || op || req.user?.username || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    const created = await docRef.get();
    res.status(201).json(formatIncident(created));
  } catch (err) {
    console.error("Create incident error:", err);
    res.status(400).json({ message: "Invalid data" });
  }
};

exports.updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ message: "Status is required" });

    const docRef = incidentsCollection.doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return res.status(404).json({ message: "Incident not found" });

    await docRef.update({ status, updatedAt: FieldValue.serverTimestamp() });
    const updated = await docRef.get();
    res.json(formatIncident(updated));
  } catch (err) {
    console.error("Update incident error:", err);
    res.status(400).json({ message: "Invalid data" });
  }
};

exports.deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = incidentsCollection.doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return res.status(404).json({ message: "Incident not found" });
    await docRef.delete();
    res.json({ message: "Incident deleted" });
  } catch (err) {
    console.error("Delete incident error:", err);
    res.status(404).json({ message: "Incident not found" });
  }
};