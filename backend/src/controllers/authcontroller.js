const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  FieldValue,
  usersCollection,
  toMillis,
} = require("../utils/firestoreCollections");

const findUserByUsername = async (username) => {
  const snapshot = await usersCollection
    .where("username", "==", username)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

const formatUser = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    username: data.username,
    createdAt: toMillis(data.createdAt),
  };
};

const seedUsername = process.env.SEED_ADMIN_USERNAME?.trim();
const seedPassword = process.env.SEED_ADMIN_PASSWORD;

const seedDefaultUser = async () => {
  if (!seedUsername || !seedPassword) return;
  try {
    const existing = await findUserByUsername(seedUsername);
    if (existing) return;

    const hash = await bcrypt.hash(seedPassword, 10);
    await usersCollection.add({
      username: seedUsername,
      password: hash,
      createdAt: FieldValue.serverTimestamp(),
      seeded: true,
    });
    console.log(`[auth] Seeded default user "${seedUsername}" from SEED_ADMIN credentials`);
  } catch (err) {
    console.error("Seed default user error:", err.message || err);
  }
};

seedDefaultUser();

exports.register = async (req, res) => {
  try {
    const username = req.body.username?.trim();
    const password = req.body.password;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const existing = await findUserByUsername(username);
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const docRef = await usersCollection.add({
      username,
      password: hash,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({ message: "User created", id: docRef.id });
  } catch (err) {
    console.error("Register error:", err);
    const payload = { message: "Server error" };
    if (process.env.NODE_ENV !== "production") payload.details = err.message;
    res.status(500).json(payload);
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await findUserByUsername(username);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    const payload = { message: "Server error" };
    if (process.env.NODE_ENV !== "production") payload.details = err.message;
    res.status(500).json(payload);
  }
};

exports.listUsers = async (req, res) => {
  try {
    const snapshot = await usersCollection.get();
    const users = snapshot.docs.map(formatUser);
    res.json(users);
  } catch (err) {
    console.error("List users error:", err);
    const payload = { message: "Server error" };
    if (process.env.NODE_ENV !== "production") payload.details = err.message;
    res.status(500).json(payload);
  }
};