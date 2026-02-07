const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      unique: true,
      required: true, // Unique paymentId in format PAY001
    },
    orderId: {
      type: String,
      required: true,
      unique: true, // Links to Order.orderId
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'cards', 'upi', 'wallets'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    restaurantAdminTransactionStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    razorpayOrderId: {
      type: String,
      required: function () {
        return this.paymentMethod !== 'cash';
      },
    },
    razorpayPaymentId: {
      type: String,
    },
    upiId: {
      type: String,
      trim: true,
      required: function () {
        return this.paymentMethod === 'upi';
      },
      match: [/^[\w.-]+@[\w.-]+$/, 'Please enter a valid UPI ID'],
    },
    cardholderName: {
      type: String,
      trim: true,
      // required: function () {
      //   return this.paymentMethod === 'cards';
      // },
    },
    cardExpiry: {
      type: String,
      trim: true,
      // required: function () {
      //   return this.paymentMethod === 'cards';
      // },
      // match: [/^\d{2}\/\d{2}$/, 'Please enter a valid expiry date (MM/YY)'],
    },
    cardToken: {
      type: String,
      trim: true,
      // required: function () {
      //   return this.paymentMethod === 'cards';
      // },
    },
    maskedCardNumber: {
      type: String,
      trim: true,
      // required: function () {
      //   return this.paymentMethod === 'cards';
      // },
      // match: [/^\*\*\*\* \*\*\*\* \*\*\*\* \d{4}$/, 'Please enter a valid masked card number'],
    },
    orderSummary: [
      {
        type: {
          type: String,
          enum: ['item', 'itemsTotal', 'discount', 'deliveryCharge', 'packingCharge', 'platformFee', 'cgst', 'sgst', 'grandTotal'],
          required: true,
        },
        id: {
          type: String, // Item ID for type: "item"
          required: function () {
            return this.type === 'item';
          },
        },
        totalCost: {
          type: String, // Total cost for type: "item" (item price × quantity + addon prices × quantities)
          required: function () {
            return this.type === 'item';
          },
        },
        value: {
          type: String, // Value for type: "itemsTotal", "discount", "deliveryCharge", "platformFee", "cgst", "sgst", "grandTotal"
          required: function () {
            return this.type !== 'item';
          },
        },
        promoCode: {
          type: String, // Promo code for type: "discount"
          required: false,
        },
      },
    ],
    appliedOffers: [
      {
        offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
        offerType: { type: String, enum: ['promo', 'freebie', 'bogo', 'combo', 'loyalty'] },
        promoCode: { type: String },
        discountAmount: { type: Number, default: 0 },
        freeItems: [{ type: String }], // For freebie and BOGO offers
        appliedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);