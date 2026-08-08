const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userType: {
      type: String,
      enum: ["customer", "partner", "restaurant", "admin"],
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "userModel",
    },

    userModel: {
      type: String,
      required: true,
      enum: [
        "User",
        "DeliveryPartner",
        "Restaurant",
        "Admin",
      ],
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      default: "general",
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    data: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.DeliveryNotification ||
  mongoose.model("DeliveryNotification", notificationSchema);