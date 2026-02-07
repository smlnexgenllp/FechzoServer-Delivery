const Cart = require("../../../models/restaurants/CartModel");
const { v4: uuidv4 } = require("uuid");

// Add or update item in cart
const addToCart = async (req, res) => {
  try {
    const { userId, foodId, quantity, price, restaurant_id } = req.body;

    if (!userId || !foodId || !quantity || !price || !restaurant_id) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Fetch all cart items for the user
    const existingCartItems = await Cart.find({ userId });

    if (existingCartItems.length > 0) {
      const existingRestaurantId = existingCartItems[0].restaurant_id;

      // If the restaurant_id is different, clear the cart before adding new item
      if (existingRestaurantId !== restaurant_id) {
        await Cart.deleteMany({ userId });
        console.log("Cart cleared as new item is from a different restaurant");
      }
    }

    // Check if the item already exists in the cart
    let cartItem = await Cart.findOne({ userId, foodId });

    if (cartItem) {
      // Update the existing item quantity
      cartItem.quantity += quantity;

      if (cartItem.quantity <= 0) {
        await Cart.deleteOne({ _id: cartItem._id });

        // ✅ Check if cart is now empty and delete entire document
        const remainingItems = await Cart.find({ userId });
        if (remainingItems.length === 0) {
          await Cart.deleteMany({ userId }); // extra safety
          console.log("Cart fully empty — user document removed.");
        }

        return res.status(200).json({ message: "Item removed from cart" });
      } else {
        await cartItem.save();
        return res.status(200).json({ message: "Cart updated", cartItem });
      }
    } else if (quantity > 0) {
      // Add new item to cart if quantity is positive
      const newCartItem = new Cart({
        cartId: uuidv4(),
        userId,
        foodId,
        quantity,
        price,
        restaurant_id,
      });

      await newCartItem.save();
      return res.status(201).json({ message: "Item added to cart", cartItem: newCartItem });
    }

    res.status(400).json({ error: "Invalid quantity" });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const { userId, cartId, quantity } = req.body;

    if (!userId || !cartId || isNaN(quantity)) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    let cartItem = await Cart.findOne({ userId, cartId });

    if (!cartItem) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    let newQuantity = cartItem.quantity + quantity;
    console.log("Updated Quantity:", newQuantity);

    if (newQuantity < 1) {
      await Cart.deleteOne({ _id: cartItem._id });

      // ✅ Check if cart is now empty and delete entire document
      const remainingItems = await Cart.find({ userId });
      if (remainingItems.length === 0) {
        await Cart.deleteMany({ userId }); // safety
        console.log("Cart fully empty — user document removed.");
      }

      return res.status(200).json({ message: "Item removed from cart" });
    }

    cartItem.quantity = newQuantity;
    await cartItem.save();

    res.status(200).json({ message: "Cart item updated", cartItem });
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { addToCart, updateCartItem };
