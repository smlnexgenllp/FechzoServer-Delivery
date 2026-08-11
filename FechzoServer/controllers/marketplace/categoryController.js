const Category = require("../../models/MarketPlace/Category");

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      isActive: true
    }).sort({ sortOrder: 1 });

    res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);

    res.status(201).json({
      success: true,
      category
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};