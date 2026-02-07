const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
  },
  restaurantName: {
    type: String,
    required: false,
  },
  type: {
    type: String,
    enum: ['suspension', 'block', 'unblock'],
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  admin: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  details: {
    duration: String,
    endDate: Date,
    blockDate: Date,
    permanentBlock: Boolean,
    guidelines: String,
    appealProcess: String,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'pending'],
    default: 'active',
  },
});

module.exports = mongoose.model('ActionLog', actionLogSchema);
