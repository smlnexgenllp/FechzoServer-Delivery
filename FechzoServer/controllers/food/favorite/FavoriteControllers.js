const Favorite = require('../../../models/User/favorite');

// POST /api/food/favorite/toggle
exports.toggleFavorite = async (req, res) => {
  try {
    const { userId, restaurantId } = req.body;

    if (!userId || !restaurantId) {
      return res.status(400).json({ message: 'Missing userId or restaurantId' });
    }

    let favorite = await Favorite.findOne({ userId });

    if (favorite) {
      const index = favorite.restaurantIds.findIndex(id => id.toString() === restaurantId.toString());

      if (index > -1) {
        favorite.restaurantIds.splice(index, 1);
        await favorite.save();
        return res.status(200).json({ status: 'removed' });
      } else {
        favorite.restaurantIds.push(restaurantId);
        await favorite.save();
        return res.status(200).json({ status: 'added' });
      }
    } else {
      await Favorite.create({ userId, restaurantIds: [restaurantId] });
      return res.status(200).json({ status: 'added' });
    }
  } catch (error) {
    console.error('Error in toggleFavorite:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};


// GET /api/food/favorite/get?userId=
exports.getFavorites = async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;  // Fetch userId from query or body

    // Log the received userId for debugging
    console.log('Fetching favorites for userId:', userId);

    const favorite = await Favorite.findOne({ userId });

    if (favorite) {
      // Return the list of restaurantIds if favorites exist
      res.json({ favorites: favorite.restaurantIds || [] });
    } else {
      // Return an empty array if no favorites are found
      res.json({ favorites: [] });
    }
  } catch (err) {
    // Log any error that occurs while fetching favorites
    console.error('Error fetching favorites:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
