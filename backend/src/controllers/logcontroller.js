const {
  logsCollection,
  FieldValue,
  toMillis,
} = require("../utils/firestoreCollections");

const coerceNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asText = (value) => (typeof value === "string" ? value.trim() : "");

const formatLog = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    plant: data.plant || "",
    plantType: data.plantType || "",
    parameter: data.parameter || "",
    value: data.numericValue ?? data.value ?? null,
    unit: data.unit || "",
    status: data.status || "OK",
    notes: data.notes || data.text || "",
    operator: data.operator || data.op || "",
    timestamp: toMillis(data.createdAt),
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
    const {
      text,
      notes,
      operator,
      op,
      parameter,
      value,
      unit,
      status,
      plant,
      plantName,
      plantType,
      plantCategory,
    } = req.body;

    const primaryNote = asText(text) || asText(notes);
    const parameterLabel = asText(parameter);
    if (!primaryNote && !parameterLabel) {
      return res.status(400).json({ message: "Provide a note or parameter" });
    }

    const operatorName = operator || op || req.user?.username;
    if (!operatorName) return res.status(400).json({ message: "Operator is required" });

    const numericValue = coerceNumber(value);
    const recordText = primaryNote || parameterLabel;

    const docRef = await logsCollection.add({
      text: recordText,
      notes: asText(notes) || recordText,
      operator: operatorName,
      parameter: parameterLabel,
      value: numericValue ?? value ?? null,
      numericValue,
      unit: unit || "",
      status: status || "OK",
      plant: plant || plantName || "",
      plantType: plantType || plantCategory || "",
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