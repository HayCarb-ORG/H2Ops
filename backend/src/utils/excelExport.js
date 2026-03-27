const ExcelJS = require("exceljs");

exports.exportLogs = async (logs) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Logs");

  sheet.columns = [
    { header: "Plant", key: "plantType" },
    { header: "Turbidity", key: "turbidity" },
    { header: "Chlorine", key: "chlorine" },
    { header: "pH", key: "ph" },
    { header: "Date", key: "createdAt" },
  ];

  logs.forEach(log => sheet.addRow(log));

  return workbook;
};