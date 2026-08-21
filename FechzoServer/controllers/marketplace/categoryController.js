const Category = require("../../models/MarketPlace/Category");

// =====================================================
// GET MAIN CATEGORIES
// GET /api/categories
// =====================================================

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      isActive: true,
      parentCategory: null,
    }).sort({
      sortOrder: 1,
      name: 1,
    });

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// GET PRODUCT CATEGORIES
// GET /api/categories/product-categories?categoryId=xxx
// =====================================================

exports.getProductCategories = async (req, res) => {
  try {
    const { categoryId } = req.query;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "categoryId is required",
      });
    }

    const categories = await Category.find({
      parentCategory: categoryId,
      isActive: true,
    }).sort({
      sortOrder: 1,
      name: 1,
    });

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error(
      "Get product categories error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// CREATE CATEGORY
// POST /api/categories
// =====================================================

exports.createCategory = async (req, res) => {
  try {
    const {
      categoryId,
      name,
      slug,
      description,
      icon,
      image,
      parentCategory,
      isActive,
      sortOrder,
    } = req.body;

    if (!categoryId || !name || !slug) {
      return res.status(400).json({
        success: false,
        message:
          "categoryId, name and slug are required",
      });
    }

    const existingCategory =
      await Category.findOne({
        $or: [
          { categoryId },
          { name },
          { slug },
        ],
      });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message:
          "Category ID, name or slug already exists",
      });
    }

    const category = await Category.create({
      categoryId,
      name,
      slug,
      description,
      icon,
      image,
      parentCategory:
        parentCategory || null,
      isActive:
        isActive !== undefined
          ? isActive
          : true,
      sortOrder:
        Number(sortOrder) || 0,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    console.error(
      "Create category error:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// GET ALL CATEGORIES
// GET /api/categories/all
// =====================================================

exports.getAllCategories = async (req, res) => {
  try {
    const categories =
      await Category.find()
        .populate(
          "parentCategory",
          "categoryId name slug"
        )
        .sort({
          sortOrder: 1,
          name: 1,
        });

    res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error(
      "Get all categories error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};