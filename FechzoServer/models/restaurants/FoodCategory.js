const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    restaurant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
  },
  { timestamps: true }
);

// Enforce unique category name per restaurant
CategorySchema.index({ name: 1, restaurant_id: 1 }, { unique: true });

module.exports = mongoose.model("Category", CategorySchema);
