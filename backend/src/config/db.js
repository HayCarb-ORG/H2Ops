const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const { MONGO_URI, MONGO_DB_NAME } = process.env;
    const options = {};

    if (MONGO_DB_NAME) options.dbName = MONGO_DB_NAME;

    console.log("Connecting to MongoDB", MONGO_DB_NAME ? `(${MONGO_DB_NAME})` : "");
    await mongoose.connect(MONGO_URI, options);

    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;