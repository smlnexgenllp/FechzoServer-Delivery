const mongoose = require('mongoose');
const Category = require('../../../models/restaurants/FoodCategory');
const Subcategory = require('../../../models/restaurants/FoodSubCategory');
const Food = require('../../../models/restaurants/FoodItemDetails');
const Addon = require('../../../models/restaurants/AddOns');

// Debug: Log registered models
// console.log('Registered Mongoose models:', mongoose.modelNames());

const getRestaurantMenu = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Validate restaurantId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid restaurant ID' });
    }

    // Fetch categories
    const categories = await Category.find({ restaurant_id: restaurantId }).lean();

    // Fetch subcategories
    const subcategories = await Subcategory.find({ restaurantId: restaurantId }).lean();

    // Fetch food items with populated add-ons
    let foods;
    let isPopulated = true;
    try {
      foods = await Food.find({ restaurant_id: restaurantId })
        .populate('add_on_id') // Populate add-ons (expects model 'AddOn')
        .lean();
    } catch (populateError) {
      console.error('Population error for add_on_id:', populateError);
      foods = await Food.find({ restaurant_id: restaurantId }).lean();
      isPopulated = false;
    }

    // Ensure add_on_id is always an array
    foods = foods.map(food => ({
      ...food,
      add_on_id: Array.isArray(food.add_on_id) ? food.add_on_id : [],
    }));

    // Structure the response: Combine categories, subcategories, and foods
    const menu = categories.map(category => {
      const categorySubcategories = subcategories.filter(
        sub => sub.category_id.toString() === category._id.toString()
      );
      const categoryFoods = foods.filter(
        food => food.category_id.toString() === category._id.toString()
      );

      return {
        ...category,
        subcategories: categorySubcategories,
        foods: categoryFoods.map(food => {
          // Compute suggested add-ons only if populated
          let suggestedAddons = [];
          if (isPopulated && Array.isArray(food.add_on_id) && food.add_on_id.length > 0) {
            suggestedAddons = food.add_on_id
              .filter(addon => addon && addon.addonItems) // Ensure addon is populated
              .flatMap(addon =>
                addon.addonItems
                  .filter(item => item.isRecommended)
                  .map(item => ({
                    _id: item._id,
                    name: item.name,
                    price: item.price,
                    addonType: item.addonType,
                    image: item.image,
                    groupName: addon.groupName,
                    groupId: addon._id,
                  }))
              );
          }

          return {
            ...food,
            subcategory_id: food.subcategory_id ? food.subcategory_id.toString() : null,
            add_on_id: food.add_on_id,
            suggestedAddons,
          };
        }),
      };
    });

    res.status(200).json(menu);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ message: 'Failed to fetch menu', error: error.message });
  }
};

module.exports = { getRestaurantMenu };