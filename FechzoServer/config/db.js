// server/config/db.js

const dns = require("node:dns");

// ============================================================
// MongoDB Atlas DNS configuration
// ============================================================
// Your Windows DNS works with nslookup, but Node.js default
// DNS resolver is refusing the MongoDB SRV lookup.
//
// Force Node.js to use public DNS servers.
// ============================================================
dns.setServers([
  "8.8.8.8",
  "1.1.1.1",
]);

const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

// ============================================================
// DATABASE CONNECTION
// ============================================================
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is not defined in the .env file"
      );
    }

    console.log("Connecting to MongoDB...");

    // --------------------------------------------------------
    // TEST MongoDB SRV DNS BEFORE MONGOOSE
    // --------------------------------------------------------
    console.log("Testing MongoDB SRV DNS...");

    const srvRecords = await dns.promises.resolveSrv(
      "_mongodb._tcp.fechzo.k1zxkpb.mongodb.net"
    );

    console.log("✅ MongoDB SRV DNS resolved:");
    console.log(
      srvRecords.map((record) => ({
        host: record.name,
        port: record.port,
      }))
    );

    // --------------------------------------------------------
    // CONNECT TO MONGODB
    // --------------------------------------------------------
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("======================================");
    console.log("✅ MongoDB connected successfully");
    console.log("======================================");

    return mongoose.connection;

  } catch (error) {
    console.error("======================================");
    console.error("❌ MongoDB connection failed");
    console.error("======================================");
    console.error(error.message);

    throw error;
  }
};

module.exports = connectDB;