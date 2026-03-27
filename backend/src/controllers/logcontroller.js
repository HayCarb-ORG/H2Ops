const {
  logsCollection,
  FieldValue,
  toMillis,
} = require("../utils/firestoreCollections");

const formatLog = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    text: data.text,
    op: data.operator,
    ts: toMillis(data.createdAt),
  };
};

exports.getLogs = async (req, res) => {
  try {
    const snapshot = await logsCollection.orderBy("createdAt", "desc").get();
    res.json(snapshot.docs.map(formatLog));
  } catch (err) {
    console.error("Fetch logs error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createLog = async (req, res) => {
  try {
    const { text, operator, op } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Log text is required" });
    const operatorName = operator || op || req.user?.username;
    if (!operatorName) return res.status(400).json({ message: "Operator is required" });

    const docRef = await logsCollection.add({
      text: text.trim(),
      operator: operatorName,
      createdAt: FieldValue.serverTimestamp(),
    });
    const created = await docRef.get();
    res.status(201).json(formatLog(created));
  } catch (err) {
    console.error("Create log error:", err);
    res.status(400).json({ message: "Invalid data" });
  }
};

exports.deleteLog = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = logsCollection.doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return res.status(404).json({ message: "Log not found" });
    await docRef.delete();
    res.json({ message: "Log deleted" });
  } catch (err) {
    console.error("Delete log error:", err);
    res.status(404).json({ message: "Log not found" });
  }
};