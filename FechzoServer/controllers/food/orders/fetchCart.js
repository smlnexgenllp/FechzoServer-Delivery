const Cart = require("../../../models/restaurants/CartModel");
const FoodItemModel = require("../../../models/restaurants/FoodItemDetails");
const Restaurant = require("../../../models/restaurants/Restaurants");

const getCartItemsWithDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const cartItems = await Cart.find({ userId });

    if (!cartItems.length) {
      return res.status(200).json([]);
    }

    const enrichedCartItems = await Promise.all(
      cartItems.map(async (item) => {

        const food = await FoodItemModel.findOne({ food_id: String(item.foodId) }).lean();

        const restaurant = await Restaurant.findOne({ restaurant_id: item.restaurant_id }).lean();

        return {
          cartId: item.cartId,
          quantity: item.quantity,
          price: item.price,
          fooditem_name: food ? food.name : "Unknown Food",
          restaurant_name: restaurant ? restaurant.restaurantDetails.name : "Unknown Restaurant",
          food_id:item.foodId,
          restaurant_id:item.restaurant_id
        };
      })
    );

    res.status(200).json(enrichedCartItems);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ message: "Error fetching cart", error });
  }
};


module.exports = { getCartItemsWithDetails };
