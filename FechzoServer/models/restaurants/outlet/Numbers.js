// /models/numbers/Numbers.js
const mongoose = require('mongoose');

const NumberSchema = new mongoose.Schema({
  restaurantPageNumbers: [{
    label: { type: String, required: true },
    number: { type: String, required: true }
  }],
  orderReminderNumbers: [{
    label: { type: String, required: true },
    number: { type: String, required: true }
  }],
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Numbers', NumberSchema);