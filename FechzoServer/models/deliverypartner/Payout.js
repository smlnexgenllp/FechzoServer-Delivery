// models/deliverypartner/Payout.js
const mongoose = require("mongoose");
const payoutSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryPartner', required: true },
  amount: { type: Number, required: true, min: 0 },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  razorpayPayoutId: String,
  transactionId: String,
  failureReason: String,
  processedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Payout', payoutSchema);