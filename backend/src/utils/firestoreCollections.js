const { admin, db } = require("../config/firestore");

const FieldValue = admin.firestore.FieldValue;

const usersCollection = db.collection("users");
const logsCollection = db.collection("logs");
const incidentsCollection = db.collection("incidents");
const datasheetsCollection = db.collection("datasheets");
const sopsCollection = db.collection("sops");

const toMillis = (timestamp) => {
  if (!timestamp) return Date.now();
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  if (timestamp instanceof Date) return timestamp.getTime();
  return Date.now();
};

module.exports = {
  FieldValue,
  usersCollection,
  logsCollection,
  incidentsCollection,
  datasheetsCollection,
  sopsCollection,
  toMillis,
};
