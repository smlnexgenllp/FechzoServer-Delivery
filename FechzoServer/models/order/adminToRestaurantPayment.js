const mongoose = require('mongoose');

const confirmedPaymentSchema = new mongoose.Schema(
  {
    confirmPaymentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    restaurantName: {
      type: String,
      required: true,
      trim: true,
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    netPayable: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'upi', 'wallet'],
      required: true,
    },
    confirmPaymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      required: true,
      default: 'completed',
    },
    paymentForDate: {
      type: Date,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    confirmedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Export the model
module.exports = mongoose.models.ConfirmedPayment || mongoose.model('ConfirmedPayment', confirmedPaymentSchema);