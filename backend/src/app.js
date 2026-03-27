const express = require("express");
const corsConfig = require("./middleware/corsConfig");
const authMiddleware = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const logRoutes = require("./routes/logs");
const incidentRoutes = require("./routes/incidents");

const app = express();

app.use(corsConfig);
app.use(express.json());

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/logs", authMiddleware, logRoutes);
app.use("/api/incidents", authMiddleware, incidentRoutes);

module.exports = app;