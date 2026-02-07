const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // optional, if you want to populate
      unique: true,
      required: true,
    },
    restaurantIds: [
      {
        type: String, // or ObjectId if you're referencing a restaurant collection
        required: true,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Favorite', favoriteSchema);
