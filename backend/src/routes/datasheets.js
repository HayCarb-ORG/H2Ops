const express = require("express");
const router = express.Router();
const {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
} = require("../controllers/datasheetController");

router.get("/", listRecords);
router.get("/:id", getRecord);
router.post("/", createRecord);
router.put("/:id", updateRecord);

module.exports = router;
