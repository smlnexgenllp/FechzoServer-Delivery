const Product = require("../../models/MarketPlace/Product");

exports.getProducts = async (req, res) => {
  try {
    const {
      category,
      storeId,
      branchId,
      productCategory
    } = req.query;

    const filter = {
      isActive: true,
      isAvailable: true
    };

    if (storeId) filter.storeId = storeId;
    if (branchId) filter.branchId = branchId;
    if (productCategory) filter.productCategory = productCategory;
    if (category) filter.mainCategory = category;

    const products = await Product.find(filter)
      .populate("mainCategory", "name slug")
      .populate("productCategory", "name slug")
      .populate("storeId", "storeName");

    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      product
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};