const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const mongoose = require('mongoose');

exports.getRestaurantDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Restaurant ID is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid restaurant ID' });
    }

    const restaurant = await Restaurant.findById(id).select(
      'restaurantName description cuisines services paymentMethods avgDeliveryTime minOrderAmount ' +
      'restaurantAddress.shopNumber restaurantAddress.floor restaurantAddress.area restaurantAddress.city ' +
      'restaurantAddress.state restaurantAddress.landmark restaurantAddress.latitude restaurantAddress.longitude ' +
      'restaurantAddress.mapLink ' + 
      'timings.dineIn.schedule timings.dineIn.isActive ' +
      'timings.delivery.schedule timings.delivery.isActive ' +
      'timings.takeaway.schedule timings.takeaway.isActive ' +
      'globalStatus rating reviewCount costForTwo images ownerDetails isOpen'
    );

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Construct fullAddress
    const fullAddress = [
      restaurant.restaurantAddress.shopNumber,
      restaurant.restaurantAddress.floor,
      restaurant.restaurantAddress.area,
      restaurant.restaurantAddress.city,
      restaurant.restaurantAddress.state,
      restaurant.restaurantAddress.landmark
    ]
      .filter(Boolean)
      .join(', ');

    // Get coordinates directly from restaurantAddress fields
    const coordinates = restaurant.restaurantAddress.latitude && restaurant.restaurantAddress.longitude
      ? {
        latitude: restaurant.restaurantAddress.latitude,
        longitude: restaurant.restaurantAddress.longitude
      }
      : null;

    res.status(200).json({
      ...restaurant._doc,
      fullAddress,
      coordinates
    });
  } catch (error) {
    console.error('Error fetching restaurant details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};