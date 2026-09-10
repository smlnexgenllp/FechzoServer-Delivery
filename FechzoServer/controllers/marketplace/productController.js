const mongoose = require("mongoose");

const Product = require("../../models/MarketPlace/Product");
const Store = require("../../models/MarketPlace/Store");
const Category = require("../../models/MarketPlace/MarketplaceCategory");

// =====================================================
// HELPERS
// =====================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const createSlug = (text = "") => {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// =====================================================
// ALLOWED GENDERS
// =====================================================

const ALLOWED_GENDERS = [
  "men",
  "women",
  "boys",
  "girls",
  "baby-kids",
  "unisex",
];

// =====================================================
// NORMALIZE GENDER
// =====================================================

const normalizeGender = (gender) => {
  if (
    gender === undefined ||
    gender === null ||
    gender === ""
  ) {
    return null;
  }

  return String(gender)
    .trim()
    .toLowerCase();
};

// =====================================================
// VALIDATE GENDER
// =====================================================

const validateGender = (gender, storeType) => {
  // Gender is only required for fashion
  if (storeType !== "fashion") {
    return null;
  }

  const normalizedGender = normalizeGender(gender);

  if (!normalizedGender) {
    return "Gender is required for fashion products";
  }

  if (!ALLOWED_GENDERS.includes(normalizedGender)) {
    return `Invalid gender. Allowed values: ${ALLOWED_GENDERS.join(
      ", "
    )}`;
  }

  return null;
};

// =====================================================
// NORMALIZE VARIANT
// =====================================================

const normalizeVariant = (variant) => {
  return {
    sku: String(variant.sku || "").trim(),

    attributes:
      variant.attributes &&
      typeof variant.attributes === "object"
        ? variant.attributes
        : {},

    // IMPORTANT:
    // Variant-specific images
    images: Array.isArray(variant.images)
      ? variant.images.filter(
          (image) =>
            typeof image === "string" &&
            image.trim()
        )
      : [],

    price: Number(variant.price),

    mrp: Number(variant.mrp),

    stock:
      variant.stock === undefined ||
      variant.stock === null ||
      variant.stock === ""
        ? 0
        : Number(variant.stock),
  };
};

// =====================================================
// POPULATE PRODUCT
// =====================================================

const populateProduct = (query) => {
  return query
    .populate({
      path: "categoryId",
      select: "name slug categoryId parentCategory",
    })
    .populate({
      path: "storeId",
      select:
        "storeName storeType phone email address logo banner status",
    });
};

// =====================================================
// VALIDATE VARIANTS
// =====================================================

const validateVariants = (variants) => {
  if (!Array.isArray(variants)) {
    return "Variants must be an array";
  }

  if (variants.length === 0) {
    return "At least one variant is required";
  }

  const skuSet = new Set();

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];

    if (!variant || typeof variant !== "object") {
      return `Invalid variant at index ${i}`;
    }

    // =================================================
    // SKU
    // =================================================

    if (
      !variant.sku ||
      typeof variant.sku !== "string" ||
      !variant.sku.trim()
    ) {
      return `SKU is required for variant ${i + 1}`;
    }

    const normalizedSku = variant.sku
      .trim()
      .toLowerCase();

    if (skuSet.has(normalizedSku)) {
      return `Duplicate SKU: ${variant.sku}`;
    }

    skuSet.add(normalizedSku);

    // =================================================
    // PRICE
    // =================================================

    const price = Number(variant.price);

    if (Number.isNaN(price) || price < 0) {
      return `Invalid price for variant ${variant.sku}`;
    }

    // =================================================
    // MRP
    // =================================================

    const mrp = Number(variant.mrp);

    if (Number.isNaN(mrp) || mrp < 0) {
      return `Invalid MRP for variant ${variant.sku}`;
    }

    if (price > mrp) {
      return `Selling price cannot be greater than MRP for ${variant.sku}`;
    }

    // =================================================
    // STOCK
    // =================================================

    const stock =
      variant.stock === undefined ||
      variant.stock === null ||
      variant.stock === ""
        ? 0
        : Number(variant.stock);

    if (Number.isNaN(stock) || stock < 0) {
      return `Invalid stock for variant ${variant.sku}`;
    }

    // =================================================
    // ATTRIBUTES
    // =================================================

    if (
      variant.attributes !== undefined &&
      variant.attributes !== null &&
      typeof variant.attributes !== "object"
    ) {
      return `Invalid attributes for variant ${variant.sku}`;
    }

    // =================================================
    // IMAGES
    // =================================================

    if (
      variant.images !== undefined &&
      !Array.isArray(variant.images)
    ) {
      return `Variant images must be an array for ${variant.sku}`;
    }
  }

  return null;
};

// =====================================================
// CHECK DUPLICATE SKUS
// =====================================================

const checkDuplicateSkus = async (
  variants,
  excludeProductId = null
) => {
  const skus = variants
    .map((variant) =>
      String(variant.sku || "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  if (!skus.length) {
    return null;
  }

  // Get all products having matching variants
  const query = {
    isDeleted: false,
    "variants.sku": {
      $in: skus,
    },
  };

  if (excludeProductId) {
    query._id = {
      $ne: excludeProductId,
    };
  }

  const products = await Product.find(query).select(
    "productId variants.sku"
  );

  for (const product of products) {
    for (const existingVariant of product.variants) {
      const existingSku = String(
        existingVariant.sku || ""
      )
        .trim()
        .toLowerCase();

      if (skus.includes(existingSku)) {
        return {
          sku: existingVariant.sku,
          productId: product.productId,
        };
      }
    }
  }

  return null;
};

// =====================================================
// GET PRODUCTS
// =====================================================

const getProducts = async (req, res) => {
  try {
    const {
      storeId,
      storeType,
      category,
      gender,
      search,
      minPrice,
      maxPrice,
      sort = "-createdAt",
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {
      isActive: true,
      isDeleted: false,
      status: "approved",
    };

    // =================================================
    // STORE
    // =================================================

    if (storeId) {
      if (!isValidObjectId(storeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid storeId",
        });
      }

      filter.storeId = storeId;
    }

    // =================================================
    // STORE TYPE
    // =================================================

    if (storeType) {
      filter.storeType = storeType
        .toString()
        .toLowerCase()
        .trim();
    }

    // =================================================
    // CATEGORY
    // =================================================

    if (category) {
      if (isValidObjectId(category)) {
        filter.categoryId = category;
      }
    }

    // =================================================
    // GENDER
    // =================================================

    if (gender) {
      const genders = String(gender)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

      if (genders.length === 1) {
        if (ALLOWED_GENDERS.includes(genders[0])) {
          filter.gender = genders[0];
        }
      } else if (genders.length > 1) {
        const validGenders = genders.filter((item) =>
          ALLOWED_GENDERS.includes(item)
        );

        if (validGenders.length > 0) {
          filter.gender = {
            $in: validGenders,
          };
        }
      }
    }

    // =================================================
    // SEARCH
    // =================================================

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
          shortDescription: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          "variants.sku": {
            $regex: searchText,
            $options: "i",
          },
        },
      ];
    }

    // =================================================
    // PRICE FILTER
    // =================================================

    if (
      minPrice !== undefined ||
      maxPrice !== undefined
    ) {
      const priceCondition = {};

      if (minPrice !== undefined) {
        const min = Number(minPrice);

        if (!Number.isNaN(min)) {
          priceCondition.$gte = min;
        }
      }

      if (maxPrice !== undefined) {
        const max = Number(maxPrice);

        if (!Number.isNaN(max)) {
          priceCondition.$lte = max;
        }
      }

      filter.variants = {
        $elemMatch: {
          price: priceCondition,
        },
      };
    }

    // =================================================
    // PAGINATION
    // =================================================

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    // =================================================
    // FETCH PRODUCTS
    // =================================================

    const [products, total] =
      await Promise.all([
        populateProduct(
          Product.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limitNumber)
        ),
        Product.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,
      products,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(
          total / limitNumber
        ),
      },
    });
  } catch (error) {
    console.error(
      "GET PRODUCTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// =====================================================
// GET STORE PRODUCTS
// =====================================================

const getStoreProducts = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!isValidObjectId(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid storeId",
      });
    }

    const {
      status,
      isActive,
      category,
      gender,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {
      storeId,
      isDeleted: false,
    };

    // =================================================
    // STATUS
    // =================================================

    if (status) {
      filter.status = status;
    }

    // =================================================
    // ACTIVE
    // =================================================

    if (isActive !== undefined) {
      filter.isActive =
        isActive === "true";
    }

    // =================================================
    // CATEGORY
    // =================================================

    if (category) {
      if (isValidObjectId(category)) {
        filter.categoryId = category;
      }
    }

    // =================================================
    // GENDER
    // =================================================

    if (gender) {
      const genders = String(gender)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

      if (genders.length === 1) {
        if (ALLOWED_GENDERS.includes(genders[0])) {
          filter.gender = genders[0];
        }
      } else if (genders.length > 1) {
        const validGenders = genders.filter((item) =>
          ALLOWED_GENDERS.includes(item)
        );

        if (validGenders.length > 0) {
          filter.gender = {
            $in: validGenders,
          };
        }
      }
    }

    // =================================================
    // SEARCH
    // =================================================

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
          "variants.sku": {
            $regex: searchText,
            $options: "i",
          },
        },
      ];
    }

    // =================================================
    // PAGINATION
    // =================================================

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    // =================================================
    // FETCH PRODUCTS
    // =================================================

    const [products, total] =
      await Promise.all([
        populateProduct(
          Product.find(filter)
            .sort("-createdAt")
            .skip(skip)
            .limit(limitNumber)
        ),
        Product.countDocuments(filter),
      ]);

    return res.status(200).json({
      success: true,
      products,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(
          total / limitNumber
        ),
      },
    });
  } catch (error) {
    console.error(
      "GET STORE PRODUCTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch store products",
      error: error.message,
    });
  }
};

// =====================================================
// GET SINGLE PRODUCT
// =====================================================

const getProductById = async (req, res) => {
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
        isDeleted: false,
        status: "approved",
      })
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
      "GET PRODUCT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// =====================================================
// CREATE PRODUCT
// =====================================================

const createProduct = async (req, res) => {
  try {
    const {
      productId,
      storeId,
      storeType,
      categoryId,
      gender,
      name,
      slug,
      brand,
      description,
      shortDescription,
      images,
      thumbnail,
      unitType,
      unit,
      variants,
      specifications,
      status,
      isActive,
    } = req.body;

    // =================================================
    // STORE VALIDATION
    // =================================================

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId is required",
      });
    }

    if (!isValidObjectId(storeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid storeId",
      });
    }

    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    // =================================================
    // STORE TYPE
    // =================================================

    const finalStoreType = String(
      storeType || store.storeType || ""
    )
      .toLowerCase()
      .trim();

    if (
      ![
        "grocery",
        "fashion",
        "electronics",
      ].includes(finalStoreType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid storeType",
      });
    }

    // =================================================
    // GENDER VALIDATION
    // =================================================

    const genderError = validateGender(
      gender,
      finalStoreType
    );

    if (genderError) {
      return res.status(400).json({
        success: false,
        message: genderError,
        field: "gender",
      });
    }

    const finalGender =
      finalStoreType === "fashion"
        ? normalizeGender(gender)
        : null;

    // =================================================
    // CATEGORY
    // =================================================

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: "categoryId is required",
      });
    }

    if (!isValidObjectId(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid categoryId",
      });
    }

    const category =
      await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // =================================================
    // NAME
    // =================================================

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required",
      });
    }

    // =================================================
    // VARIANTS VALIDATION
    // =================================================

    const variantError =
      validateVariants(variants);

    if (variantError) {
      return res.status(400).json({
        success: false,
        message: variantError,
      });
    }

    // =================================================
    // NORMALIZE VARIANTS
    // =================================================

    const normalizedVariants =
      variants.map(normalizeVariant);

    // =================================================
    // PRODUCT ID
    // =================================================

    const finalProductId =
      productId &&
      String(productId).trim()
        ? String(productId).trim()
        : undefined;

    if (finalProductId) {
      const existingProduct =
        await Product.findOne({
          productId: finalProductId,
        });

      if (existingProduct) {
        return res.status(409).json({
          success: false,
          message: `Product ID already exists: ${finalProductId}`,
          field: "productId",
          error: "DUPLICATE_PRODUCT_ID",
        });
      }
    }

    // =================================================
    // SLUG
    // =================================================

    const finalSlug =
      slug && slug.trim()
        ? createSlug(slug)
        : createSlug(name);

    const existingSlug =
      await Product.findOne({
        slug: finalSlug,
      });

    if (existingSlug) {
      return res.status(409).json({
        success: false,
        message: `Product slug already exists: ${finalSlug}`,
        field: "slug",
        error: "DUPLICATE_SLUG",
      });
    }

    // =================================================
    // DUPLICATE SKU CHECK
    // =================================================

    const duplicateSku =
      await checkDuplicateSkus(
        normalizedVariants
      );

    if (duplicateSku) {
      return res.status(409).json({
        success: false,
        message: `SKU already exists: ${duplicateSku.sku}`,
        sku: duplicateSku.sku,
        productId:
          duplicateSku.productId,
        field: "variants.sku",
        error: "DUPLICATE_SKU",
      });
    }

    // =================================================
    // CREATE PRODUCT
    // =================================================

    const product =
      await Product.create({
        productId:
          finalProductId,

        storeId,

        storeType:
          finalStoreType,

        categoryId,

        // =================================================
        // GENDER
        // =================================================

        gender: finalGender,

        name: name.trim(),

        slug: finalSlug,

        brand:
          brand?.trim() || "",

        description:
          description?.trim() || "",

        shortDescription:
          shortDescription?.trim() || "",

        images:
          Array.isArray(images)
            ? images.filter(Boolean)
            : [],

        thumbnail:
          thumbnail ||
          (
            Array.isArray(images)
              ? images[0]
              : ""
          ) ||
          "",

        unitType:
          unitType || "count",

        unit:
          unit || "piece",

        // =================================================
        // VARIANTS WITH IMAGES
        // =================================================

        variants:
          normalizedVariants,

        specifications:
          specifications || {},

        status:
          status || "pending",

        isActive:
          isActive !== undefined
            ? Boolean(isActive)
            : true,

        isDeleted: false,
      });

    // =================================================
    // POPULATE
    // =================================================

    const populatedProduct =
      await populateProduct(
        Product.findById(product._id)
      );

    return res.status(201).json({
      success: true,
      message:
        "Product created successfully",
      product: populatedProduct,
    });
  } catch (error) {
    console.error(
      "================================================="
    );

    console.error(
      "CREATE PRODUCT ERROR"
    );

    console.error(
      "MESSAGE:",
      error.message
    );

    console.error(
      "CODE:",
      error.code
    );

    console.error(
      "KEY PATTERN:",
      error.keyPattern
    );

    console.error(
      "KEY VALUE:",
      error.keyValue
    );

    console.error(
      "================================================="
    );

    // =================================================
    // MONGODB DUPLICATE KEY
    // =================================================

    if (error.code === 11000) {
      const duplicateField =
        Object.keys(
          error.keyPattern || {}
        )[0];

      return res.status(409).json({
        success: false,
        message: `Duplicate value already exists for ${
          duplicateField || "unique field"
        }`,
        field:
          duplicateField || null,
        value:
          error.keyValue || null,
        error: "DUPLICATE_KEY",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create product",
      error: error.message,
    });
  }
};

// =====================================================
// UPDATE PRODUCT
// =====================================================

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product =
      await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const {
      categoryId,
      gender,
      name,
      slug,
      brand,
      description,
      shortDescription,
      images,
      thumbnail,
      unitType,
      unit,
      variants,
      specifications,
      isActive,
      status,
    } = req.body;

    // =================================================
    // CATEGORY
    // =================================================

    if (categoryId !== undefined) {
      if (!isValidObjectId(categoryId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid categoryId",
        });
      }

      const category =
        await Category.findById(
          categoryId
        );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      product.categoryId =
        categoryId;
    }

    // =================================================
    // GENDER
    // =================================================

    if (gender !== undefined) {
      const normalizedGender =
        normalizeGender(gender);

      // Fashion product
      if (product.storeType === "fashion") {
        const genderError =
          validateGender(
            normalizedGender,
            product.storeType
          );

        if (genderError) {
          return res.status(400).json({
            success: false,
            message: genderError,
            field: "gender",
          });
        }

        product.gender =
          normalizedGender;
      } else {
        // Non-fashion product
        product.gender = null;
      }
    }

    // =================================================
    // IMPORTANT
    // If existing fashion product has no gender
    // and gender is not sent during update,
    // don't silently save invalid gender.
    // =================================================

    if (
      product.storeType === "fashion" &&
      gender === undefined &&
      !ALLOWED_GENDERS.includes(
        normalizeGender(product.gender)
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Gender is required for fashion products",
        field: "gender",
      });
    }

    // =================================================
    // NAME
    // =================================================

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Product name cannot be empty",
        });
      }

      product.name =
        name.trim();
    }

    // =================================================
    // SLUG
    // =================================================

    if (slug !== undefined) {
      const finalSlug =
        createSlug(slug);

      if (!finalSlug) {
        return res.status(400).json({
          success: false,
          message:
            "Product slug cannot be empty",
        });
      }

      const existingSlug =
        await Product.findOne({
          slug: finalSlug,
          _id: {
            $ne: id,
          },
        });

      if (existingSlug) {
        return res.status(409).json({
          success: false,
          message: `Product slug already exists: ${finalSlug}`,
          field: "slug",
          error: "DUPLICATE_SLUG",
        });
      }

      product.slug =
        finalSlug;
    }

    // =================================================
    // BASIC FIELDS
    // =================================================

    if (brand !== undefined) {
      product.brand =
        brand?.trim() || "";
    }

    if (description !== undefined) {
      product.description =
        description?.trim() || "";
    }

    if (
      shortDescription !== undefined
    ) {
      product.shortDescription =
        shortDescription?.trim() || "";
    }

    if (images !== undefined) {
      product.images =
        Array.isArray(images)
          ? images.filter(Boolean)
          : [];
    }

    if (thumbnail !== undefined) {
      product.thumbnail =
        thumbnail || "";
    }

    if (unitType !== undefined) {
      product.unitType =
        unitType;
    }

    if (unit !== undefined) {
      product.unit =
        unit;
    }

    // =================================================
    // VARIANTS
    // =================================================

    if (variants !== undefined) {
      const variantError =
        validateVariants(variants);

      if (variantError) {
        return res.status(400).json({
          success: false,
          message: variantError,
        });
      }

      const normalizedVariants =
        variants.map(
          normalizeVariant
        );

      // =================================================
      // DUPLICATE SKU CHECK
      // Exclude current product
      // =================================================

      const duplicateSku =
        await checkDuplicateSkus(
          normalizedVariants,
          id
        );

      if (duplicateSku) {
        return res.status(409).json({
          success: false,
          message: `SKU already exists: ${duplicateSku.sku}`,
          sku: duplicateSku.sku,
          productId:
            duplicateSku.productId,
          field: "variants.sku",
          error: "DUPLICATE_SKU",
        });
      }

      // =================================================
      // PRESERVE EXISTING VARIANT IDs
      // =================================================

      product.variants =
        normalizedVariants.map(
          (variant, index) => ({
            _id:
              variants[index]?._id &&
              isValidObjectId(
                variants[index]._id
              )
                ? variants[index]._id
                : new mongoose.Types.ObjectId(),

            sku:
              variant.sku,

            attributes:
              variant.attributes,

            // IMPORTANT
            // Variant-specific images
            images:
              variant.images,

            price:
              variant.price,

            mrp:
              variant.mrp,

            stock:
              variant.stock,
          })
        );
    }

    // =================================================
    // SPECIFICATIONS
    // =================================================

    if (
      specifications !== undefined
    ) {
      product.specifications =
        specifications || {};
    }

    // =================================================
    // ACTIVE
    // =================================================

    if (isActive !== undefined) {
      product.isActive =
        Boolean(isActive);
    }

    // =================================================
    // STATUS
    // =================================================

    if (status !== undefined) {
      product.status =
        status;
    }

    // =================================================
    // SAVE
    // =================================================

    await product.save();

    // =================================================
    // POPULATE
    // =================================================

    const populatedProduct =
      await populateProduct(
        Product.findById(
          product._id
        )
      );

    return res.status(200).json({
      success: true,
      message:
        "Product updated successfully",
      product: populatedProduct,
    });
  } catch (error) {
    console.error(
      "================================================="
    );

    console.error(
      "UPDATE PRODUCT ERROR"
    );

    console.error(
      "MESSAGE:",
      error.message
    );

    console.error(
      "CODE:",
      error.code
    );

    console.error(
      "KEY PATTERN:",
      error.keyPattern
    );

    console.error(
      "KEY VALUE:",
      error.keyValue
    );

    console.error(
      "================================================="
    );

    // =================================================
    // DUPLICATE KEY
    // =================================================

    if (error.code === 11000) {
      const duplicateField =
        Object.keys(
          error.keyPattern || {}
        )[0];

      return res.status(409).json({
        success: false,
        message: `Duplicate value already exists for ${
          duplicateField || "unique field"
        }`,
        field:
          duplicateField || null,
        value:
          error.keyValue || null,
        error: "DUPLICATE_KEY",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to update product",
      error: error.message,
    });
  }
};

// =====================================================
// DELETE PRODUCT
// =====================================================

const deleteProduct = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product =
      await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.isDeleted = true;
    product.isActive = false;

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE PRODUCT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete product",
      error: error.message,
    });
  }
};

// =====================================================
// RESTORE PRODUCT
// =====================================================

const restoreProduct = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product =
      await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.isDeleted = false;
    product.isActive = true;

    await product.save();

    return res.status(200).json({
      success: true,
      message:
        "Product restored successfully",
    });
  } catch (error) {
    console.error(
      "RESTORE PRODUCT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to restore product",
      error: error.message,
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getProducts,
  getStoreProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
};