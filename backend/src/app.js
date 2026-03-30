const express = require("express");
const { corsMiddleware } = require("./middleware/corsConfig");
const authMiddleware = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const logRoutes = require("./routes/logs");
const incidentRoutes = require("./routes/incidents");
const dashboardRoutes = require("./routes/dashboard");
const datasheetRoutes = require("./routes/datasheets");
const sopRoutes = require("./routes/sop");

const app = express();

app.use(corsMiddleware);
app.use(express.json());

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/logs", authMiddleware, logRoutes);
app.use("/api/incidents", authMiddleware, incidentRoutes);
app.use("/api/dashboard", authMiddleware, dashboardRoutes);
app.use("/api/datasheets", authMiddleware, datasheetRoutes);
app.use("/api/sop", authMiddleware, sopRoutes);

module.exports = app;