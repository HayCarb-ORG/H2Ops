const {
  sopsCollection,
  FieldValue,
  toMillis,
} = require("../utils/firestoreCollections");

const normalizeSteps = (steps) => {
  if (Array.isArray(steps)) {
    return steps.map((step) => String(step || "").trim()).filter(Boolean);
  }
  if (typeof steps === "string") {
    return steps
      .split(/\r?\n/)
      .map((step) => step.trim())
      .filter(Boolean);
  }
  return [];
};

const formatSop = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    plant: data.plant || "",
    title: data.title || "",
    steps: data.steps || [],
    tags: data.tags || [],
    createdBy: data.createdBy || "",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt || data.createdAt),
  };
};

exports.listSops = async (req, res) => {
  try {
    const { plant } = req.query;
    let query = sopsCollection.orderBy("createdAt", "desc");
    if (plant) {
      query = sopsCollection.where("plant", "==", plant);
    }
    const snapshot = await query.get();
    const items = snapshot.docs.map(formatSop);
    const sorted = plant
      ? items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      : items;
    res.json(sorted);
  } catch (err) {
    console.error("List SOP error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createSop = async (req, res) => {
  try {
    const title = (req.body.title || "").trim();
    if (!title) return res.status(400).json({ message: "Title is required" });
    const steps = normalizeSteps(req.body.steps);
    if (!steps.length) return res.status(400).json({ message: "Add at least one step" });

    const docRef = await sopsCollection.add({
      plant: req.body.plant || "",
      title,
      steps,
      tags: req.body.tags || [],
      createdBy: req.user?.username || "Operator",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const snapshot = await docRef.get();
    res.status(201).json(formatSop(snapshot));
  } catch (err) {
    console.error("Create SOP error:", err);
    res.status(400).json({ message: "Invalid data" });
  }
};

exports.updateSop = async (req, res) => {
  try {
    const docRef = sopsCollection.doc(req.params.id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return res.status(404).json({ message: "SOP not found" });

    const title = (req.body.title || snapshot.data().title || "").trim();
    if (!title) return res.status(400).json({ message: "Title is required" });
    const steps = normalizeSteps(req.body.steps || snapshot.data().steps);
    if (!steps.length) return res.status(400).json({ message: "Add at least one step" });

    await docRef.update({
      plant: req.body.plant ?? snapshot.data().plant ?? "",
      title,
      steps,
      tags: req.body.tags ?? snapshot.data().tags ?? [],
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    res.json(formatSop(updated));
  } catch (err) {
    console.error("Update SOP error:", err);
    res.status(400).json({ message: "Invalid data" });
  }
};

exports.deleteSop = async (req, res) => {
  try {
    const docRef = sopsCollection.doc(req.params.id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return res.status(404).json({ message: "SOP not found" });
    await docRef.delete();
    res.json({ message: "SOP deleted" });
  } catch (err) {
    console.error("Delete SOP error:", err);
    res.status(404).json({ message: "SOP not found" });
  }
};
