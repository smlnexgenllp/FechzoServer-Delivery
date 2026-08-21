const mongoose = require("mongoose");
const Product = require("../../models/MarketPlace/Product");

/* =========================================================
   HELPERS
========================================================= */

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const populateProduct = (query) => {
  return query
    .populate("mainCategory", "categoryId name slug")
    .populate("productCategory", "categoryId name slug")
    .populate(
      "storeId",
      "storeName storeType logo banner phone email status"
    )
    .populate("branchId");
};


/* =========================================================
   GET ALL MARKETPLACE PRODUCTS
   Customer-facing API

   Supports:
   - category
   - productCategory
   - storeId
   - branchId
   - search
   - minPrice
   - maxPrice
   - sort
   - page
   - limit
========================================================= */

exports.getProducts = async (req, res) => {
  try {
    const {
      category,
      storeId,
      branchId,
      productCategory,
      search,
      minPrice,
      maxPrice,
      sort = "latest",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {
      isActive: true,
      isAvailable: true,
    };

    // STORE
    if (storeId) {
      filter.storeId = storeId;
    }

    // BRANCH
    if (branchId) {
      filter.branchId = branchId;
    }

    // MAIN CATEGORY
    if (category) {
      filter.mainCategory = category;
    }

    // PRODUCT CATEGORY
    if (productCategory) {
      filter.productCategory = productCategory;
    }

    // SEARCH
    if (search && search.trim()) {
      const searchText = search.trim();

      filter.$or = [
        {
          name: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          brand: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          description: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          sku: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          productId: {
            $regex: searchText,
            $options: "i",
          },
        },
      ];
    }

    // PRICE
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};

      if (
        minPrice !== undefined &&
        minPrice !== ""
      ) {
        filter.price.$gte = Number(minPrice);
      }

      if (
        maxPrice !== undefined &&
        maxPrice !== ""
      ) {
        filter.price.$lte = Number(maxPrice);
      }
    }

    // SORT
    let sortQuery = {
      createdAt: -1,
    };

    switch (sort) {
      case "price-low":
        sortQuery = {
          price: 1,
        };
        break;

      case "price-high":
        sortQuery = {
          price: -1,
        };
        break;

      case "rating":
        sortQuery = {
          rating: -1,
        };
        break;

      case "discount":
        sortQuery = {
          discountPrice: -1,
        };
        break;

      case "latest":
      default:
        sortQuery = {
          createdAt: -1,
        };
        break;
    }

    // PAGINATION
    const currentPage = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(
        parseInt(limit, 10) || 20,
        1
      ),
      100
    );

    const skip =
      (currentPage - 1) * perPage;

    // FETCH
    const products = await Product.find(filter)
      .populate({
        path: "mainCategory",
        select: "_id categoryId name slug",
      })
      .populate({
        path: "productCategory",
        select: "_id categoryId name slug parentCategory",
      })
      .populate({
        path: "storeId",
        select:
          "_id storeName storeType logo status",
      })
      .populate({
        path: "branchId",
      })
      .sort(sortQuery)
      .skip(skip)
      .limit(perPage)
      .lean();

    const totalProducts =
      await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      products,
      pagination: {
        currentPage,
        perPage,
        totalProducts,
        totalPages:
          Math.ceil(
            totalProducts / perPage
          ),
      },
    });
  } catch (error) {
    console.error(
      "Get Products Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/* =========================================================
   GET STORE PRODUCTS
   Store Admin API

   IMPORTANT:
   This returns both active and inactive products.

   Example:
   GET /api/products/store?storeId=xxxx
========================================================= */

exports.getStoreProducts = async (req, res) => {
  try {
    const {
      storeId,
      branchId,
      search,
      page = 1,
      limit = 100,
    } = req.query;


    /* =====================================================
       STORE ID VALIDATION
    ===================================================== */

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "Store ID is required",
      });
    }

    if (!isValidObjectId(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID",
      });
    }


    /* =====================================================
       FILTER
    ===================================================== */

    const filter = {
      storeId,
    };


    /* =====================================================
       BRANCH
    ===================================================== */

    if (branchId) {
      if (!isValidObjectId(branchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid branch ID",
        });
      }

      filter.branchId = branchId;
    }


    /* =====================================================
       SEARCH
    ===================================================== */

    if (search && search.trim()) {
      const searchValue = search.trim();

      filter.$or = [
        {
          name: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          brand: {
            $regex: searchValue,
            $options: "i",
          },
        },
        {
          sku: {
            $regex: searchValue,
            $options: "i",
          },
        },
      ];
    }


    /* =====================================================
       PAGINATION
    ===================================================== */

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const perPage = Math.min(
      Math.max(Number(limit) || 100, 1),
      100
    );

    const skip =
      (currentPage - 1) * perPage;


    /* =====================================================
       FETCH
    ===================================================== */

    const products = await populateProduct(
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .lean()
    );


    /* =====================================================
       TOTAL
    ===================================================== */

    const totalProducts =
      await Product.countDocuments(filter);


    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,
      products,
      pagination: {
        currentPage,
        perPage,
        totalProducts,
        totalPages: Math.ceil(
          totalProducts / perPage
        ),
      },
    });
  } catch (error) {
    console.error(
      "Get Store Products Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/* =========================================================
   GET SINGLE PRODUCT
   Customer-facing API
========================================================= */

exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;


    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }


    const product = await populateProduct(
      Product.findOne({
        _id: id,
        isActive: true,
        isAvailable: true,
      }).lean()
    );


    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }


    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error(
      "Get Product By ID Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/* =========================================================
   CREATE PRODUCT
========================================================= */

exports.createProduct = async (req, res) => {
  try {
    const {
      productId,
      storeId,
      branchId,
      mainCategory,
      productCategory,
      name,
      description,
      brand,
      images,
      price,
      discountPrice,
      stock,
      unit,
      sku,
      highlights,
      attributes,
      deliveryInfo,
      returnPolicy,
      isAvailable,
      isActive,
    } = req.body;


    /* =====================================================
       REQUIRED VALIDATION
    ===================================================== */

    if (!productId || !productId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }


    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "Store ID is required",
      });
    }


    if (!isValidObjectId(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID",
      });
    }


    if (!mainCategory) {
      return res.status(400).json({
        success: false,
        message: "Main category is required",
      });
    }


    if (!isValidObjectId(mainCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid main category ID",
      });
    }


    if (!productCategory) {
      return res.status(400).json({
        success: false,
        message: "Product category is required",
      });
    }


    if (!isValidObjectId(productCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product category ID",
      });
    }


    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }


    /* =====================================================
       PRICE
    ===================================================== */

    const productPrice = Number(price);

    if (
      price === undefined ||
      price === null ||
      price === "" ||
      Number.isNaN(productPrice) ||
      productPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid product price is required",
      });
    }


    /* =====================================================
       DISCOUNT PRICE
    ===================================================== */

    const finalDiscountPrice =
      discountPrice !== undefined &&
      discountPrice !== null &&
      discountPrice !== ""
        ? Number(discountPrice)
        : 0;


    if (
      Number.isNaN(finalDiscountPrice) ||
      finalDiscountPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount price",
      });
    }


    if (
      finalDiscountPrice > 0 &&
      finalDiscountPrice >= productPrice
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Discount price must be less than product price",
      });
    }


    /* =====================================================
       STOCK
    ===================================================== */

    const finalStock =
      stock !== undefined &&
      stock !== null &&
      stock !== ""
        ? Number(stock)
        : 0;


    if (
      Number.isNaN(finalStock) ||
      finalStock < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock value",
      });
    }


    /* =====================================================
       BRANCH
    ===================================================== */

    if (
      branchId &&
      !isValidObjectId(branchId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid branch ID",
      });
    }


    /* =====================================================
       DUPLICATE PRODUCT ID
    ===================================================== */

    const existingProduct =
      await Product.findOne({
        productId: productId.trim(),
      });


    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "Product ID already exists",
      });
    }


    /* =====================================================
       CREATE PRODUCT
    ===================================================== */

    const product =
      await Product.create({
        productId: productId.trim(),

        storeId,

        branchId:
          branchId || null,

        mainCategory,

        productCategory,

        name: name.trim(),

        description:
          description || "",

        brand:
          brand || "",

        images:
          Array.isArray(images)
            ? images
            : [],

        price: productPrice,

        discountPrice:
          finalDiscountPrice,

        stock:
          finalStock,

        unit:
          unit || "piece",

        sku:
          sku || "",

        highlights:
          Array.isArray(highlights)
            ? highlights
            : [],

        attributes:
          attributes &&
          typeof attributes === "object"
            ? attributes
            : {},

        deliveryInfo:
          deliveryInfo ||
          "Free Delivery",

        returnPolicy:
          returnPolicy ||
          "7 Days Replacement",

        isAvailable:
          isAvailable !== undefined
            ? Boolean(isAvailable)
            : true,

        isActive:
          isActive !== undefined
            ? Boolean(isActive)
            : true,
      });


    /* =====================================================
       POPULATED RESPONSE
    ===================================================== */

    const populatedProduct =
      await populateProduct(
        Product.findById(
          product._id
        )
      );


    return res.status(201).json({
      success: true,
      message:
        "Product created successfully",
      product: populatedProduct,
    });
  } catch (error) {
    console.error(
      "Create Product Error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


/* =========================================================
   UPDATE PRODUCT
   Store Admin

   Requires:
   - URL product ID
   - storeId in body
========================================================= */

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { storeId } = req.body;


    /* =====================================================
       PRODUCT ID
    ===================================================== */

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }


    /* =====================================================
       STORE ID
    ===================================================== */

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "Store ID is required",
      });
    }


    if (!isValidObjectId(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID",
      });
    }


    /* =====================================================
       FIND PRODUCT FOR THIS STORE
    ===================================================== */

    const product =
      await Product.findOne({
        _id: id,
        storeId,
      });


    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found for this store",
      });
    }


    /* =====================================================
       ALLOWED FIELDS
    ===================================================== */

    const allowedFields = [
      "branchId",
      "mainCategory",
      "productCategory",
      "name",
      "description",
      "brand",
      "images",
      "price",
      "discountPrice",
      "stock",
      "unit",
      "sku",
      "highlights",
      "attributes",
      "deliveryInfo",
      "returnPolicy",
      "isAvailable",
      "isActive",
    ];


    allowedFields.forEach((field) => {
      if (
        req.body[field] !== undefined
      ) {
        product[field] =
          req.body[field];
      }
    });


    /* =====================================================
       VALIDATE NAME
    ===================================================== */

    if (
      !product.name ||
      !product.name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }


    product.name =
      product.name.trim();


    /* =====================================================
       VALIDATE PRICE
    ===================================================== */

    product.price =
      Number(product.price);


    if (
      Number.isNaN(product.price) ||
      product.price < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product price",
      });
    }


    /* =====================================================
       DISCOUNT PRICE
    ===================================================== */

    product.discountPrice =
      Number(product.discountPrice) || 0;


    if (
      product.discountPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount price",
      });
    }


    if (
      product.discountPrice > 0 &&
      product.discountPrice >= product.price
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Discount price must be less than product price",
      });
    }


    /* =====================================================
       STOCK
    ===================================================== */

    product.stock =
      Number(product.stock) || 0;


    if (product.stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid stock value",
      });
    }


    /* =====================================================
       CATEGORY VALIDATION
    ===================================================== */

    if (
      product.mainCategory &&
      !isValidObjectId(
        product.mainCategory
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid main category ID",
      });
    }


    if (
      product.productCategory &&
      !isValidObjectId(
        product.productCategory
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid product category ID",
      });
    }


    /* =====================================================
       BRANCH VALIDATION
    ===================================================== */

    if (
      product.branchId &&
      !isValidObjectId(
        product.branchId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid branch ID",
      });
    }


    /* =====================================================
       SAVE
    ===================================================== */

    await product.save();


    /* =====================================================
       POPULATED RESPONSE
    ===================================================== */

    const updatedProduct =
      await populateProduct(
        Product.findById(
          product._id
        )
      );


    return res.status(200).json({
      success: true,
      message:
        "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error(
      "Update Product Error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


/* =========================================================
   DELETE PRODUCT
   Soft Delete

   Requires:
   - URL product ID
   - storeId query parameter

   Example:
   DELETE /api/products/:id?storeId=xxxx
========================================================= */

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { storeId } = req.query;


    /* =====================================================
       PRODUCT ID
    ===================================================== */

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }


    /* =====================================================
       STORE ID
    ===================================================== */

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "Store ID is required",
      });
    }


    if (!isValidObjectId(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID",
      });
    }


    /* =====================================================
       FIND PRODUCT
    ===================================================== */

    const product =
      await Product.findOne({
        _id: id,
        storeId,
      });


    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found for this store",
      });
    }


    /* =====================================================
       SOFT DELETE
    ===================================================== */

    product.isActive = false;

    product.isAvailable = false;


    await product.save();


    return res.status(200).json({
      success: true,
      message:
        "Product deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Product Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/* =========================================================
   RESTORE PRODUCT
   Optional but useful for Store Admin
========================================================= */

exports.restoreProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { storeId } = req.body;


    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }


    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "Store ID is required",
      });
    }


    if (!isValidObjectId(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid store ID",
      });
    }


    const product =
      await Product.findOne({
        _id: id,
        storeId,
      });


    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found for this store",
      });
    }


    product.isActive = true;
    product.isAvailable = true;


    await product.save();


    return res.status(200).json({
      success: true,
      message:
        "Product restored successfully",
      product,
    });
  } catch (error) {
    console.error(
      "Restore Product Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};