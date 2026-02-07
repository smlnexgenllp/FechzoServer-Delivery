// Routes - restaurant portal
const express = require("express");
const router = express.Router();
const multer = require("multer");
const FoodItem = require("../../../models/restaurants/FoodItemDetails");
const { createCategory, updateCategory } = require("../../../controllers/restaurantportal/CategoryForm");
const { addSubcategory, updateSubcategory } = require("../../../controllers/restaurantportal/SubCategoryForm");
const { getCategoriesByRestaurant } = require("../../../controllers/restaurantportal/FetchCategories");
const { createAddon } = require("../../../controllers/restaurantportal/AddOnsForm");
const subcategoryController = require("../../../controllers/restaurantportal/FetchSubCategories");
const addonController = require("../../../controllers/restaurantportal/FetchAddOns");
const { addFood } = require("../../../controllers/restaurantportal/AddFoodItem");
const { getFoodItems } = require("../../../controllers/restaurantportal/FetchFoodItems");
const {editFood} = require("../../../controllers/restaurantportal/EditFoodItem");
const { updateAddon } = require("../../../controllers/restaurantportal/EditAddOns");
const foodController = require("../../../controllers/restaurantportal/DeleteFoodItems");

// Multer config
const storage = multer.diskStorage({
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Define routes
router.post("/categoryform", createCategory);
router.put("/categoryform", updateCategory); 

router.post("/addsubcategory", addSubcategory);
router.put("/addsubcategory", updateSubcategory); // <-- Add this line
router.post("/addfooditem", upload.single("image"), addFood);
router.put("/editfooditem", upload.single("image"), editFood);
router.post("/addons", upload.any(), createAddon);
router.put("/editaddons/:id", upload.any(), updateAddon);
router.get("/categories/:restaurant_id", getCategoriesByRestaurant);
router.get("/fetchsubcategories/:restaurantId/:categoryId", subcategoryController.getSubcategories);
router.get("/addons/:restaurantId", addonController.getAddonsByRestaurant);
router.delete("/fooditems/:foodId", foodController.deleteFoodItem);
// Food items (subcategory optional)
router.get("/fooditems/:restaurantId/:categoryId/:subcategoryId?", getFoodItems);
router.get("/allfooditems/:restaurantId", async (req, res) => {
  try {
    const foodItems = await FoodItem.find({ restaurant_id: req.params.restaurantId });
    res.json(foodItems);
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching food items" });
  }
});
module.exports = router;
