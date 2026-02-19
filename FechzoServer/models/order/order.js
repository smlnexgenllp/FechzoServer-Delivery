const mongoose = require('mongoose');

// Counter Schema
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 },
});
mongoose.model('Counter', counterSchema);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
    },

    restaurantName: String,
    restaurantImage: String,

    cartItems: [
      {
        id: String,
        name: String,
        quantity: Number,
        price: Number,
        image: String,
        unit: String,
        addons: [
          {
            groupId: mongoose.Schema.Types.ObjectId,
            itemId: mongoose.Schema.Types.ObjectId,
            name: String,
            price: Number,
            quantity: Number,
          },
        ],
        specialInstructions: String,
      },
    ],

    total: {
      type: Number,
      required: true,
    },

    selectedAddress: {
      type: { type: String, required: true },
      name: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
      phone: String,
    },

    deliveryLocation: {
  type: {
    type: String,
    enum: ["Point"],
    required: true,
    default: "Point",
  },
  coordinates: {
    type: [Number], // [lng, lat]
    required: true,
    validate: {
      validator: function (val) {
        return Array.isArray(val) && val.length === 2;
      },
      message: "Coordinates must be [longitude, latitude]",
    },
  },
},


    orderStatus: {
      type: String,
      default: 'placed',
    },
    deliveryPartnerStatus: {
      type: String,
      enum: [
        'pending',
        'accepted',
        'reached_restaurant',
        'picked_up',
        'reached_customer',
        'delivered',
        'failed',
        'cancelled_by_partner',
      ],
      default: 'pending',
      index: true,
    },
    // 🔴 DELIVERY PARTNER INFO (NEW)
    delivery: {
      partnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryPartner',
        default: null,
      },
      assignedAt: Date,
      reachedRestaurantAt: Date,
      pickedUpAt: Date,
      reachedCustomerAt: Date,
      deliveredAt: Date,
      // NEW: For late delivery tracking
      estimatedDeliveryTime: Date, // Set when partner accepts or picks up
      delayReportedAt: Date,
      delayReason: String, // e.g., "Heavy traffic", "Customer not reachable"
    },

    cancellationReason: {
      type: String,
      required: function () {
        return this.orderStatus === 'cancelled';
      },
    },
    cancelledBy: {
      type: String,
      enum: ['customer', 'restaurant', 'partner', 'system'],
      default: null,
    },
    cancelledAt: Date,

    appliedOffers: [
      {
        offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
        offerType: String,
        promoCode: String,
        discountAmount: Number,
        freeItems: [String],
        appliedAt: { type: Date, default: Date.now },
      },
    ],
     // In models/order/order.js
partnerRating: {
  type: Number,
  min: 1,
  max: 5,
  default: null
},
partnerReview: {
  type: String,
  trim: true,
  default: null
},
partnerRatedAt: {
  type: Date,
  default: null
},
    refundStatus: {
      type: String,
      enum: ['pending', 'approved', 'sent_to_admin', 'completed', 'rejected'],
      default: 'pending',
    },
    refundEligible: { type: Boolean, default: true },
    refundAmount: { type: Number, default: 0 },
    refundNotes: String,
    refundRequestDate: Date,
    refundCompletedDate: Date,
  },
  { timestamps: true }
);
orderSchema.index({ deliveryLocation: "2dsphere" });

module.exports = mongoose.model('Order', orderSchema);
