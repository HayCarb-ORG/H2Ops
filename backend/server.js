require("dotenv").config();
const app = require("./src/app");

// Initialize Firestore before handling requests
require("./src/config/firestore");

app.listen(5000, () => {
  console.log("Server running on port 5000");
});