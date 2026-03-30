const {
  logsCollection,
  incidentsCollection,
  toMillis,
} = require("../utils/firestoreCollections");

const formatLog = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    plant: data.plant || "",
    plantType: data.plantType || "",
    parameter: (data.parameter || "").trim(),
    value: data.numericValue ?? data.value ?? null,
    unit: data.unit || "",
    status: data.status || "OK",
    notes: data.notes || data.text || "",
    timestamp: toMillis(data.createdAt),
  };
};

const formatIncident = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || "",
    severity: (data.severity || data.sev || "Low").trim(),
    status: (data.status || "Open").trim(),
    timestamp: toMillis(data.createdAt),
  };
};

const metricMatch = (log, aliases = []) => {
  if (!log.parameter) return false;
  const label = log.parameter.toLowerCase();
  return aliases.some((alias) => label.includes(alias));
};

const buildMetric = (log, fallbackUnit = "") => {
  if (!log) return null;
  return {
    value: log.value ?? log.notes,
    unit: log.unit || fallbackUnit,
    timestamp: log.timestamp,
    status: log.status || "OK",
    plant: log.plant,
  };
};

const severityRank = (severity = "") => {
  const order = ["low", "medium", "high", "critical"];
  const idx = order.indexOf(severity.toLowerCase());
  return idx === -1 ? 0 : idx;
};

exports.getStats = async (req, res) => {
  try {
    const [logSnapshot, incidentSnapshot] = await Promise.all([
      logsCollection.orderBy("createdAt", "desc").limit(50).get(),
      incidentsCollection.orderBy("createdAt", "desc").limit(50).get(),
    ]);

    const logs = logSnapshot.docs.map(formatLog);
    const incidents = incidentSnapshot.docs.map(formatIncident);

    const turbidityLog = logs.find((log) => metricMatch(log, ["turbidity", "ntu"]));
    const chlorineLog = logs.find((log) => metricMatch(log, ["chlorine", "cl2", "frc"]));
    const ctLog = logs.find((log) => metricMatch(log, ["ct", "contact time"]));

    const openIncidents = incidents.filter((inc) => inc.status.toLowerCase() !== "closed");
    const highestSeverity = openIncidents.reduce(
      (rank, inc) => Math.max(rank, severityRank(inc.severity)),
      0
    );

    const statusLabels = ["Stable", "Monitor", "Investigate", "Action Required"];

    res.json({
      filteredTurbidity: buildMetric(turbidityLog, "NTU"),
      freeChlorine: buildMetric(chlorineLog, "mg/L"),
      ctValue: buildMetric(ctLog, "mg*min/L"),
      chemicalStatus: statusLabels[highestSeverity] || "Stable",
      totalLogs: logSnapshot.size,
      openIncidents: openIncidents.length,
      activeAlerts: openIncidents.filter((inc) => severityRank(inc.severity) >= 2).length,
      recentLogs: logs.slice(0, 6),
      openIncidentDetails: openIncidents.slice(0, 6),
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
