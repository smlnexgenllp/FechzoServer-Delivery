const mongoose = require("mongoose");

const addonSchema = new mongoose.Schema({
  groupName: { type: String, required: true },
  restaurant_id: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
  addonItems: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() }, // Explicit _id
      name: { type: String, required: true },
      price: { type: Number, required: true },
      addonType: { type: String },
      image: { type: String },
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model("Addon", addonSchema);