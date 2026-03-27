const admin = require("firebase-admin");

const parseServiceAccount = () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (error) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
};

if (!admin.apps.length) {
  let credential;
  const serviceAccount = parseServiceAccount();

  if (serviceAccount) {
    console.log("Initializing Firebase Admin with FIREBASE_SERVICE_ACCOUNT credentials");
    credential = admin.credential.cert(serviceAccount);
  } else {
    try {
      console.log("Initializing Firebase Admin with application default credentials");
      credential = admin.credential.applicationDefault();
    } catch (error) {
      throw new Error(
        "Firestore credentials missing. Provide FIREBASE_SERVICE_ACCOUNT JSON or set GOOGLE_APPLICATION_CREDENTIALS."
      );
    }
  }

  admin.initializeApp({ credential });
  console.log("Firebase Admin SDK initialized");
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
console.log("Firestore client ready");

module.exports = { admin, db };
