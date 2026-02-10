const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema({
  restaurant_id: { type: String, required: true, unique: true },
  restaurant_thumbnail: { type: String },
  restaurant_logo: { type: String },
  restaurantDetails: {
    name: { type: String, required: true },
    description: { type: String, required: true }
  },
  ownerDetails: {
    owner_name: { type: String, required: true },
    contact: { type: String, required: true }
  },
  locationDetails: {
    state: { type: String, required: true },
    region: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    geo: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    }
   // Can be further detailed if needed
  },
  cuisines: [String],
  ratings: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  tags: [String],
  services: [String],
  meal_types: [String],
  food_types: [String],
  seo_details: { type: Object }, // Add structure
  is_open: { type: Boolean, default: true },
  operationalDetails: {
    opening_time: { type: String, required: true },
    closing_time: { type: String, required: true }
  },
  status: { type: String, default: "active" },
}, { timestamps: true });

RestaurantSchema.index({ "locationDetails.geo": "2dsphere" });
module.exports = mongoose.model("restaurants", RestaurantSchema);
