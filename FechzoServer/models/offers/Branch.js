// models/Branch.js
const mongoose = require('mongoose');

const BranchDemoSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true }, // Changed from ObjectId ref to String
  name: { type: String, required: true },
  address: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('BranchDemo', BranchDemoSchema);