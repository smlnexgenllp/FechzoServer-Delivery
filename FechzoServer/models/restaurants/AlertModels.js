const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});

module.exports = mongoose.model('Alert', alertSchema);