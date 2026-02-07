// /models/managers/Managers.js
const mongoose = require('mongoose');

const ManagerSchema = new mongoose.Schema({
  outlet_id: { type: String, required: true }, // Link to outlet
  managers: [{
    name: { type: String, required: true },
    designation: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }
  }],
  selectedManager: { // Tracks the currently selected manager
    name: String,
    designation: String,
    email: String,
    phone: String
  },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Managers', ManagerSchema);