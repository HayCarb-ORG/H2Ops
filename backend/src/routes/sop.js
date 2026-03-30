const express = require("express");
const router = express.Router();
const {
  listSops,
  createSop,
  updateSop,
  deleteSop,
} = require("../controllers/sopController");

router.get("/", listSops);
router.post("/", createSop);
router.put("/:id", updateSop);
router.delete("/:id", deleteSop);

module.exports = router;
