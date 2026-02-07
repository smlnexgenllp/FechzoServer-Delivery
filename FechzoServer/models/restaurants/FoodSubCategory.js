const mongoose = require("mongoose");
 
const SubcategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true }
}, { timestamps: true });
 
module.exports = mongoose.model("Subcategory", SubcategorySchema);