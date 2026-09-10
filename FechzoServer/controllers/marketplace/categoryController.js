const Category = require("../../models/MarketPlace/MarketplaceCategory");

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

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// GET SUB CATEGORIES
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

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error(
      "Get product categories error:",
      error
    );

    return res.status(500).json({
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
          { categoryId: categoryId.trim() },
          { name: name.trim() },
          { slug: slug.trim().toLowerCase() },
        ],
      });

    if (existingCategory) {
      return res.status(409).json({
        success: false,
        message:
          "Category ID, name or slug already exists",
      });
    }

    if (parentCategory) {
      const parent =
        await Category.findById(parentCategory);

      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    const category =
      await Category.create({
        categoryId: categoryId.trim(),

        name: name.trim(),

        slug: slug.trim().toLowerCase(),

        description:
          description || "",

        icon:
          icon || "",

        image:
          image || "",

        parentCategory:
          parentCategory || null,

        isActive:
          isActive !== undefined
            ? Boolean(isActive)
            : true,

        sortOrder:
          Number(sortOrder) || 0,
      });

    return res.status(201).json({
      success: true,
      message:
        "Category created successfully",
      category,
    });
  } catch (error) {
    console.error(
      "Create category error:",
      error
    );

    return res.status(400).json({
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

    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error(
      "Get all categories error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};