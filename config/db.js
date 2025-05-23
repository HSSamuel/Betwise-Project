const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
// This code connects to a MongoDB database using Mongoose. It exports a function that attempts to connect to the database using the URI stored in the environment variable MONGO_URI. If the connection is successful, it logs "MongoDB connected" to the console. If there is an error, it logs the error message and exits the process with a status code of 1.
