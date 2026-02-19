// models/deliverypartner/PartnerPayoutRequest.js
const mongoose = require('mongoose');

const payoutRequestSchema = new mongoose.Schema({
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner',
    required: true,
  },
  amount: { type: Number, required: true, min: 500 },
  requestedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected', 'failed'],
    default: 'pending',
  },
  adminNotes: String,
  razorpayPayoutId: String,
  failureReason: String,
  processedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('PartnerPayoutRequest', payoutRequestSchema);