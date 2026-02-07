const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  restaurant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
  items: [
    {
      foodId: { type: mongoose.Schema.Types.ObjectId, ref: "Food", required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      addons: [
        {
          groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Addon", required: true },
          itemId: { type: mongoose.Schema.Types.ObjectId, required: true }, // References addonItems._id
          name: { type: String },
          price: { type: Number },
          quantity: { type: Number, default: 1 },
        },
      ],
    },
  ],
});

module.exports = mongoose.model("Cart", cartSchema);