const Cart = require("../../../models/restaurants/CartModel");
const Food = require("../../../models/restaurants/FoodItemDetails");
const ActionLog = require("../../../models/restaurants/actionlogs/actionlogschema");

const mongoose = require("mongoose");

// ✅ Add to Cart
const addToCart = async (req, res) => {
  const { userId, restaurantId, foodId, quantity, price, addons, clearCart } = req.body;

  try {
    let cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });

    // Handle explicit cart clearing for restaurant change
    if (clearCart && cart) {
      await Cart.deleteOne({ _id: cart._id });
      return res.status(200).json({ message: "Cart cleared successfully", items: [] });
    }

    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({ message: "Food item not found" });
    }

    const normalizeAddons = (addons) => {
      if (!addons || addons.length === 0) return [];
      return addons
        .map((a) => ({
          groupId: a.groupId?.toString() || "",
          itemId: a.itemId?.toString() || "",
          name: a.name || "",
          price: a.price || 0,
          quantity: a.quantity || 1,
        }))
        .sort((a, b) => a.groupId.localeCompare(b.groupId) || a.itemId.localeCompare(b.itemId));
    };

    const formattedAddons = normalizeAddons(addons || []);

    if (!cart) {
      if (quantity <= 0) {
        return res.status(400).json({ message: "Cannot add item with 0 or negative quantity to cart" });
      }

      cart = new Cart({
        userId: new mongoose.Types.ObjectId(userId),
        restaurant_id: new mongoose.Types.ObjectId(restaurantId),
        items: [{ foodId, quantity, price, addons: formattedAddons }],
      });
    } else {
      if (!cart.restaurant_id || cart.restaurant_id.toString() !== restaurantId) {
        // Return a specific status code for different restaurant
        return res.status(409).json({ 
          message: "Your cart contains items from another restaurant",
          currentRestaurantId: cart.restaurant_id.toString(),
          newRestaurantId: restaurantId,
          conflict: true
        });
      }

      const existingItemIndex = cart.items.findIndex(
        (item) => item.foodId.toString() === foodId
      );

      if (existingItemIndex >= 0) {
        if (quantity > 0) {
          cart.items[existingItemIndex].quantity = quantity;
          cart.items[existingItemIndex].price = price;
          cart.items[existingItemIndex].addons = formattedAddons;
        } else {
          cart.items.splice(existingItemIndex, 1);
        }
      } else if (quantity > 0) {
        cart.items.push({ foodId, quantity, price, addons: formattedAddons });
      }

      // ✅ Clean up cart if empty
      if (cart.items.length === 0) {
        await Cart.deleteOne({ _id: cart._id });
        return res.status(200).json({ message: "Cart is now empty", items: [] });
      }
    }

    await cart.save();
    const populatedCart = await Cart.findById(cart._id).populate("items.foodId");
    res.status(200).json(populatedCart);
  } catch (error) {
    console.error("addToCart_error", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Get Cart
const getCart = async (req, res) => {
  const { userId } = req.query;

  try {
    const cart = await Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) })
      .populate("items.foodId")
      .populate({
        path: "restaurant_id",
        select: "restaurantName globalStatus restaurantAddress",
      });

    if (!cart) {
      return res.status(200).json({ items: [] });
    }

    // Check for active suspension or block actions
    const actionLog = await ActionLog.findOne({
      restaurantId: cart.restaurant_id._id,
      type: { $in: ["suspension", "block"] },
      status: "active",
    });

    if (actionLog) {
      // Restaurant is suspended or blocked, remove the cart
      await Cart.deleteOne({ _id: cart._id });
      return res.status(200).json({ items: [], message: "Cart cleared due to restaurant suspension or block" });
    }

    res.status(200).json(cart);
  } catch (error) {
    console.error("getCart_error", error);
    res.status(500).json({ message: "Server error" });
  }
};


const updateCartItem = async (req, res) => {
  try {
    const { userId, foodId, quantity, addonItemId, addonQuantity } = req.body;

    // Validate required fields
    if (!userId || !foodId) {
      return res.status(400).json({ message: "userId and foodId are required" });
    }

    // Fetch the cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    console.log("Cart before update:", JSON.stringify(cart.items, null, 2));

    // Find the item to update
    const item = cart.items.find((item) => item.foodId.toString() === foodId);
    if (!item) {
      return res.status(400).json({ message: "Item not found in cart" });
    }

    // Update item quantity if provided
    if (typeof quantity === "number") {
      item.quantity = quantity;
    }

    // Update add-ons if provided
    if (addonItemId && typeof addonQuantity === "number") {
      if (addonQuantity > 0) {
        const addon = item.addons.find(
          (addon) => addon.itemId.toString() === addonItemId
        );
        if (addon) {
          addon.quantity = addonQuantity;
        } else {
          return res.status(400).json({ message: "Add-on not found" });
        }
      } else {
        // Remove the add-on
        item.addons = item.addons.filter(
          (addon) => addon.itemId.toString() !== addonItemId
        );
      }
    }

    // Remove items with quantity 0
    cart.items = cart.items.filter((item) => item.quantity > 0);

    // Filter invalid add-ons
    cart.items.forEach((item) => {
      item.addons = item.addons.filter((addon) => {
        const isValid =
          addon.itemId &&
          addon.groupId &&
          addon.name &&
          addon.price &&
          addon.quantity > 0;
        if (!isValid) {
          console.log("Filtering invalid add-on:", addon);
        }
        return isValid;
      });
    });

    // Log the cart state after modifications
    console.log("Cart after modifications:", JSON.stringify(cart.items, null, 2));

    // Delete cart if empty
    if (cart.items.length === 0) {
      await Cart.deleteOne({ _id: cart._id });
      return res.status(200).json({ message: "Cart is now empty", items: [] });
    }

    // Save the cart
    await cart.save();
    console.log("Cart after save:", JSON.stringify(cart.items, null, 2));

    // Populate for response
    const populatedCart = await Cart.findOne({ userId }).populate({
      path: "items.foodId",
      select: "name price image unit packingcharge available_status",
    });
    res.json({ message: "Cart updated", cart: populatedCart });
  } catch (error) {
    console.error("Error updating cart:", {
      message: error.message,
      stack: error.stack,
      errors: error.errors,
    });
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Cart validation failed",
        errors: error.errors,
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Delete Cart
const deleteCart = async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await Cart.deleteOne({ userId: new mongoose.Types.ObjectId(userId) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Cart not found" });
    }
    
    res.status(200).json({ message: "Cart cleared successfully", items: [] });
  } catch (error) {
    console.error("deleteCart_error", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { addToCart, getCart, updateCartItem, deleteCart };
