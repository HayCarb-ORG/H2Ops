const {
  datasheetsCollection,
  FieldValue,
  toMillis,
} = require("../utils/firestoreCollections");

const normalizeFields = (fields) => (fields && typeof fields === "object" ? fields : {});

const buildSummary = (fields) => ({
  date: fields.ds_date || fields.date || null,
  visitNo: fields.ds_visitNo || fields.visitNo || null,
  visitedBy: fields.ds_visitedBy || fields.visitedBy || "",
  location: fields.ds_location || fields.location || "",
});

const formatRecord = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    plant: data.plant || "",
    plantType: data.plantType || "",
    date: data.date || null,
    summary: data.summary || {},
    fields: data.fields || {},
    createdBy: data.createdBy || "",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt || data.createdAt),
  };
};

exports.listRecords = async (req, res) => {
  try {
    const { plant } = req.query;
    let query = datasheetsCollection.orderBy("createdAt", "desc").limit(50);
    if (plant) {
      query = datasheetsCollection.where("plant", "==", plant);
    }
    const snapshot = await query.get();
    const records = snapshot.docs.map(formatRecord);
    const sorted = plant
      ? records.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 50)
      : records;
    res.json(sorted);
  } catch (err) {
    console.error("List datasheets error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getRecord = async (req, res) => {
  try {
    const docRef = datasheetsCollection.doc(req.params.id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return res.status(404).json({ message: "Record not found" });
    res.json(formatRecord(snapshot));
  } catch (err) {
    console.error("Get datasheet error:", err);
    res.status(404).json({ message: "Record not found" });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const fields = normalizeFields(req.body.fields);
    if (!Object.keys(fields).length) {
      return res.status(400).json({ message: "Datasheet fields are required" });
    }

    const payload = {
      plant: req.body.plant || "",
      plantType: req.body.plantType || "",
      date: req.body.date || fields.ds_date || new Date().toISOString(),
      fields,
      summary: buildSummary(fields),
      createdBy: req.user?.username || "Operator",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await datasheetsCollection.add(payload);
    const snapshot = await docRef.get();
    res.status(201).json(formatRecord(snapshot));
  } catch (err) {
    console.error("Create datasheet error:", err);
    res.status(400).json({ message: "Invalid data" });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const fields = normalizeFields(req.body.fields);
    if (!Object.keys(fields).length) {
      return res.status(400).json({ message: "Datasheet fields are required" });
    }

    const docRef = datasheetsCollection.doc(req.params.id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return res.status(404).json({ message: "Record not found" });

    await docRef.update({
      plant: req.body.plant ?? snapshot.data().plant ?? "",
      plantType: req.body.plantType ?? snapshot.data().plantType ?? "",
      date: req.body.date || fields.ds_date || snapshot.data().date || null,
      fields,
      summary: buildSummary(fields),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    res.json(formatRecord(updated));
  } catch (err) {
    console.error("Update datasheet error:", err);
    res.status(400).json({ message: "Invalid data" });
  }
};
