const mongoose = require("mongoose");

const FoodSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  food_type: { type: String, required: true },
  image: { type: String },
  packingcharge:{type:Number},
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  subcategory_id: { type: mongoose.Schema.Types.ObjectId, ref: "Subcategory" },
  available_status: { type: Boolean, default: true },
  cuisine: { type: String },
  restaurant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
  quantity: { type: Number, default: 1 },
  food_id: { type: String, unique: true },
  add_on_id: [{ type: mongoose.Schema.Types.ObjectId, ref: "Addon" }],
  price: { type: Number, required: true },
  serviceType: { type: [String], required: true },
  isBestseller: { type: Boolean, default: false },
  autoUpdate: { type: Boolean, default: false },
  availableTimeStart: { type: String, default: "" },
  availableTimeEnd: { type: String, default: "" },
});

module.exports = mongoose.model("Food", FoodSchema);