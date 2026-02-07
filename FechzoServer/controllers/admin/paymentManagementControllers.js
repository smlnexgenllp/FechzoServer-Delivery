const mongoose = require("mongoose");
const Order = require("../../models/order/order");
const Payment = require("../../models/order/payment");
const ConfirmedPayment = require("../../models/order/adminToRestaurantPayment");
const Restaurant = require("../../models/restaurants/shops/RestaurantDetails");
const { v4: uuidv4 } = require("uuid");

const getStartOfMonth = (date) => {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0); // Set to UTC midnight
  return d;
};

const getStartOfDay = (date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

exports.getDailyPayments = async (req, res) => {
  try {
    const { date } = req.query;
    const queryDate = date || new Date().toISOString().split("T")[0];
    const startDate = new Date(queryDate);
    startDate.setHours(0, 0, 0, 0); // Start of the day in local time
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1); // End of the day

    // Normalize startDate to UTC midnight for $lookup
    const utcStartDate = getStartOfDay(startDate);

    // Count payments (both pending and completed)
    const paymentCount = await Payment.countDocuments({
      createdAt: { $gte: startDate, $lt: endDate },
      paymentStatus: { $in: ["pending", "completed"] },
    });

    if (paymentCount === 0) {
      return res.json({
        restaurants: [],
        overallTotalRevenue: 0,
        message: "No payments found for the selected date",
      });
    }

    const finalPayments = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lt: endDate },
          paymentStatus: { $in: ["pending", "completed"] },
        },
      },
      {
        $lookup: {
          from: Order.collection.name,
          localField: "orderId",
          foreignField: "orderId", // Fixed: Added colon (:) after foreignField
          as: "order",
        },
      },
      { $unwind: { path: "$order", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: Restaurant.collection.name,
          localField: "order.restaurantId",
          foreignField: "_id",
          as: "restaurant",
        },
      },
      { $unwind: { path: "$restaurant", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: ConfirmedPayment.collection.name,
          let: {
            restaurantId: "$order.restaurantId",
            paymentForDate: utcStartDate,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$restaurantId", "$$restaurantId"] },
                    {
                      $eq: [
                        { $dateTrunc: { date: "$paymentForDate", unit: "day", timezone: "UTC" } },
                        "$$paymentForDate",
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "confirmedPayment",
        },
      },
      {
        $addFields: {
          confirmedPayment: { $arrayElemAt: ["$confirmedPayment", 0] },
          paymentForDate: utcStartDate,
        },
      },
      {
        $group: {
          _id: {
            restaurantId: "$restaurant._id",
            restaurantName: "$order.restaurantName",
            restaurantImage: "$order.restaurantImage",
          },
          ordersCompleted: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $let: {
                vars: {
                  grandTotal: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$orderSummary",
                          as: "item",
                          cond: { $eq: ["$$item.type", "grandTotal"] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $toDouble: { $ifNull: ["$$grandTotal.value", 0] } },
              },
            },
          },
          platformFee: {
            $sum: {
              $let: {
                vars: {
                  fee: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$orderSummary",
                          as: "item",
                          cond: { $eq: ["$$item.type", "platformFee"] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $toDouble: { $ifNull: ["$$fee.value", 0] } },
              },
            },
          },
          deliveryFee: {
            $sum: {
              $let: {
                vars: {
                  fee: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$orderSummary",
                          as: "item",
                          cond: { $eq: ["$$item.type", "deliveryCharge"] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $toDouble: { $ifNull: ["$$fee.value", 0] } },
              },
            },
          },
          taxes: {
            $sum: {
              $sum: [
                {
                  $let: {
                    vars: {
                      cgst: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$orderSummary",
                              as: "item",
                              cond: { $eq: ["$$item.type", "cgst"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: { $toDouble: { $ifNull: ["$$cgst.value", 0] } },
                  },
                },
                {
                  $let: {
                    vars: {
                      sgst: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$orderSummary",
                              as: "item",
                              cond: { $eq: ["$$item.type", "sgst"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: { $toDouble: { $ifNull: ["$$sgst.value", 0] } },
                  },
                },
              ],
            },
          },
          status: {
            $max: {
              $cond: {
                if: { $eq: ["$restaurantAdminTransactionStatus", "failed"] },
                then: "pending",
                else: "$restaurantAdminTransactionStatus",
              },
            },
          },
          paymentForDate: { $first: "$paymentForDate" },
          paymentDate: { $first: "$confirmedPayment.paymentDate" },
          paymentMethod: { $first: "$confirmedPayment.paymentMethod" },
        },
      },
      {
        $project: {
          id: { $toString: "$_id.restaurantId" },
          name: "$_id.restaurantName",
          logo: "$_id.restaurantImage",
          ordersCompleted: 1,
          totalRevenue: 1,
          platformFee: 1,
          deliveryFee: 1,
          taxes: 1,
          netPayable: {
            $subtract: ["$totalRevenue", "$platformFee"], // Subtract only platformFee
          },
          status: 1,
          paymentForDate: 1,
          paymentDate: 1,
          paymentMethod: 1,
          _id: 0,
        },
      },
      { $sort: { status: 1, totalRevenue: -1 } },
    ]);

    const overallTotalRevenue = finalPayments.reduce(
      (sum, restaurant) => sum + (restaurant.totalRevenue || 0),
      0
    );

    res.json({
      restaurants: finalPayments,
      overallTotalRevenue,
    });
  } catch (error) {
    console.error("Error in getDailyPayments:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

exports.getMonthlyPayments = async (req, res) => {
  try {
    const { year, month, searchQuery = "" } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }

    const startDate = getStartOfMonth(new Date(`${year}-${month}-01`));
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const paymentCount = await Payment.countDocuments({
      createdAt: { $gte: startDate, $lt: endDate },
      paymentStatus: { $in: ["pending", "completed"] },
    });

    if (paymentCount === 0) {
      return res.json({
        restaurants: [],
        overallTotalRevenue: 0,
        message: "No payments found for the selected month",
      });
    }

    const finalPayments = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lt: endDate },
          paymentStatus: { $in: ["pending", "completed"] },
        },
      },
      {
        $lookup: {
          from: Order.collection.name,
          localField: "orderId",
          foreignField: "orderId",
          as: "order",
        },
      },
      { $unwind: { path: "$order", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: Restaurant.collection.name,
          localField: "order.restaurantId",
          foreignField: "_id",
          as: "restaurant",
        },
      },
      { $unwind: { path: "$restaurant", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: ConfirmedPayment.collection.name,
          let: { restaurantId: "$order.restaurantId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$restaurantId", "$$restaurantId"] },
                    { $gte: ["$paymentForDate", startDate] },
                    { $lt: ["$paymentForDate", endDate] },
                  ],
                },
              },
            },
          ],
          as: "confirmedPayment",
        },
      },
      {
        $addFields: {
          confirmedPayment: { $arrayElemAt: ["$confirmedPayment", 0] },
          confirmationStatus: {
            $cond: {
              if: { $eq: [{ $ifNull: ["$confirmedPayment", null] }, null] },
              then: "pending",
              else: "$confirmedPayment.confirmPaymentStatus",
            },
          },
        },
      },
      {
        $match: searchQuery
          ? { "order.restaurantName": { $regex: searchQuery, $options: "i" } }
          : {},
      },
      {
        $group: {
          _id: {
            restaurantId: "$restaurant._id",
            restaurantName: "$order.restaurantName",
            restaurantImage: "$order.restaurantImage",
          },
          ordersCompleted: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $let: {
                vars: {
                  grandTotal: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$orderSummary",
                          as: "item",
                          cond: { $eq: ["$$item.type", "grandTotal"] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $toDouble: { $ifNull: ["$$grandTotal.value", 0] } },
              },
            },
          },
          platformFee: {
            $sum: {
              $let: {
                vars: {
                  fee: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$orderSummary",
                          as: "item",
                          cond: { $eq: ["$$item.type", "platformFee"] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $toDouble: { $ifNull: ["$$fee.value", 0] } },
              },
            },
          },
          deliveryFee: {
            $sum: {
              $let: {
                vars: {
                  fee: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$orderSummary",
                          as: "item",
                          cond: { $eq: ["$$item.type", "deliveryCharge"] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $toDouble: { $ifNull: ["$$fee.value", 0] } },
              },
            },
          },
          taxes: {
            $sum: {
              $sum: [
                {
                  $let: {
                    vars: {
                      cgst: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$orderSummary",
                              as: "item",
                              cond: { $eq: ["$$item.type", "cgst"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: { $toDouble: { $ifNull: ["$$cgst.value", 0] } },
                  },
                },
                {
                  $let: {
                    vars: {
                      sgst: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$orderSummary",
                              as: "item",
                              cond: { $eq: ["$$item.type", "sgst"] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: { $toDouble: { $ifNull: ["$$sgst.value", 0] } },
                  },
                },
              ],
            },
          },
          status: { $first: "$confirmationStatus" },
          paymentDate: { $first: "$confirmedPayment.paymentDate" },
          paymentMethod: { $first: "$confirmedPayment.paymentMethod" },
        },
      },
      {
        $project: {
          id: { $toString: "$_id.restaurantId" },
          name: "$_id.restaurantName",
          logo: "$_id.restaurantImage",
          ordersCompleted: 1,
          totalRevenue: 1,
          platformFee: 1,
          deliveryFee: 1,
          taxes: 1,
          netPayable: {
            $subtract: ["$totalRevenue", "$platformFee"], // Subtract only platformFee
          },
          status: 1,
          paymentDate: 1,
          paymentMethod: 1,
          _id: 0,
        },
      },
      { $sort: { status: 1, totalRevenue: -1 } },
    ]);

    const overallTotalRevenue = finalPayments.reduce(
      (sum, restaurant) => sum + (restaurant.totalRevenue || 0),
      0
    );

    res.json({
      restaurants: finalPayments,
      overallTotalRevenue,
    });
  } catch (error) {
    console.error("Error in getMonthlyPayments:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    const { startDate, endDate, searchQuery = "", page = 1, limit = 10 } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Start date and end date are required" });
    }

    // Normalize dates to UTC midnight
    const start = getStartOfDay(new Date(startDate));
    const end = getStartOfDay(new Date(endDate));
    end.setDate(end.getDate() + 1);

    // Count total confirmed payments for pagination
    const matchQuery = {
      paymentForDate: { $gte: start, $lt: end },
      confirmPaymentStatus: "completed",
    };

    const totalPayments = await ConfirmedPayment.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalPayments / limit);

    // Aggregation pipeline
    const pipeline = [
      {
        $match: matchQuery,
      },
      // Lookup Restaurant details
      {
        $lookup: {
          from: Restaurant.collection.name,
          localField: "restaurantId",
          foreignField: "_id",
          as: "restaurant",
        },
      },
      {
        $unwind: { path: "$restaurant", preserveNullAndEmptyArrays: true }, // Allow missing restaurants
      },
      // Add fallback restaurant name from ConfirmedPayment
      {
        $addFields: {
          restaurantNameFinal: {
            $ifNull: [
              "$restaurant.name",
              "$restaurantName", // Fallback to ConfirmedPayment.restaurantName
              "Unknown Restaurant",
            ],
          },
          debugRestaurant: {
            restaurantId: "$restaurantId",
            restaurantName: "$restaurant.name",
            confirmedRestaurantName: "$restaurantName",
          },
        },
      },
      // Lookup Orders for the restaurant within the paymentForDate
      {
        $lookup: {
          from: Order.collection.name,
          let: { restaurantId: "$restaurantId", paymentForDate: "$paymentForDate" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$restaurantId", "$$restaurantId"] },
                    {
                      $gte: [
                        "$createdAt",
                        "$$paymentForDate",
                      ],
                    },
                    {
                      $lt: [
                        "$createdAt",
                        { $dateAdd: { startDate: "$$paymentForDate", unit: "day", amount: 1 } },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "orders",
        },
      },
      // Lookup Payments for the orders
      {
        $lookup: {
          from: Payment.collection.name,
          let: { orderIds: { $map: { input: "$orders", as: "order", in: "$$order.orderId" } } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$orderId", "$$orderIds"] },
                    { $in: ["$paymentStatus", ["pending", "completed"]] },
                  ],
                },
              },
            },
          ],
          as: "payments",
        },
      },
      // Apply search query on restaurantNameFinal
      {
        $match: searchQuery
          ? { restaurantNameFinal: { $regex: searchQuery, $options: "i" } }
          : {},
      },
      // Group by restaurant
      {
        $group: {
          _id: {
            restaurantId: "$restaurantId",
            restaurantName: "$restaurantNameFinal",
            restaurantImage: "$orders.restaurantImage",
          },
          ordersCompleted: { $sum: { $size: "$orders" } },
          totalRevenue: {
            $sum: {
              $sum: {
                $map: {
                  input: "$payments",
                  as: "payment",
                  in: {
                    $let: {
                      vars: {
                        grandTotal: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$$payment.orderSummary",
                                as: "item",
                                cond: { $eq: ["$$item.type", "grandTotal"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: { $toDouble: { $ifNull: ["$$grandTotal.value", 0] } },
                    },
                  },
                },
              },
            },
          },
          platformFee: {
            $sum: {
              $sum: {
                $map: {
                  input: "$payments",
                  as: "payment",
                  in: {
                    $let: {
                      vars: {
                        fee: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$$payment.orderSummary",
                                as: "item",
                                cond: { $eq: ["$$item.type", "platformFee"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: { $toDouble: { $ifNull: ["$$fee.value", 0] } },
                    },
                  },
                },
              },
            },
          },
          deliveryFee: {
            $sum: {
              $sum: {
                $map: {
                  input: "$payments",
                  as: "payment",
                  in: {
                    $let: {
                      vars: {
                        fee: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$$payment.orderSummary",
                                as: "item",
                                cond: { $eq: ["$$item.type", "deliveryCharge"] },
                              },
                            },
                            0,
                          ],
                        },
                      },
                      in: { $toDouble: { $ifNull: ["$$fee.value", 0] } },
                    },
                  },
                },
              },
            },
          },
          taxes: {
            $sum: {
              $sum: {
                $map: {
                  input: "$payments",
                  as: "payment",
                  in: {
                    $sum: [
                      {
                        $let: {
                          vars: {
                            cgst: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: "$$payment.orderSummary",
                                    as: "item",
                                    cond: { $eq: ["$$item.type", "cgst"] },
                                  },
                                },
                                0,
                              ],
                            },
                          },
                          in: { $toDouble: { $ifNull: ["$$cgst.value", 0] } },
                        },
                      },
                      {
                        $let: {
                          vars: {
                            sgst: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: "$$payment.orderSummary",
                                    as: "item",
                                    cond: { $eq: ["$$item.type", "sgst"] },
                                  },
                                },
                                0,
                              ],
                            },
                          },
                          in: { $toDouble: { $ifNull: ["$$sgst.value", 0] } },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          status: { $first: "$confirmPaymentStatus" },
          paymentForDate: { $first: "$paymentForDate" },
          paymentDate: { $first: "$paymentDate" },
          paymentMethod: { $first: "$paymentMethod" },
        },
      },
      // Project the final output
      {
        $project: {
          id: { $toString: "$_id.restaurantId" },
          name: "$_id.restaurantName",
          logo: {
            $arrayElemAt: [
              "$_id.restaurantImage",
              0,
            ],
          },
          ordersCompleted: 1,
          totalRevenue: 1,
          platformFee: 1,
          deliveryFee: 1,
          taxes: 1,
          netPayable: {
            $subtract: ["$totalRevenue", "$platformFee"], // Subtract only platformFee
          },
          status: 1,
          paymentForDate: 1,
          paymentDate: 1,
          paymentMethod: 1,
          _id: 0,
        },
      },
      // Sort by paymentDate and totalRevenue
      { $sort: { paymentDate: -1, totalRevenue: -1 } },
      // Pagination
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
    ];

    // Execute aggregation
    const payments = await ConfirmedPayment.aggregate(pipeline);

    // Calculate overall total revenue
    const overallTotalRevenue = payments.reduce(
      (sum, payment) => sum + (payment.totalRevenue || 0),
      0
    );

    // Log for debugging
    console.log('Payment History Response:', JSON.stringify({
      payments: payments.map(p => ({
        id: p.id,
        name: p.name,
        logo: p.logo,
        ordersCompleted: p.ordersCompleted,
        totalRevenue: p.totalRevenue,
      })),
      overallTotalRevenue,
      currentPage: parseInt(page),
      totalPages,
      totalPayments,
    }, null, 2));

    // Send response
    res.json({
      payments,
      overallTotalRevenue,
      currentPage: parseInt(page),
      totalPages,
      totalPayments,
    });
  } catch (error) {
    console.error("Error in getPaymentHistory:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    const {
      restaurantId,
      paymentForDate,
      paymentDate,
      paymentMethod,
      netPayable,
      ordersCompleted,
      platformFee,
      deliveryFee,
      taxes,
      totalRevenue,
    } = req.body;

    // Validate required fields
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId is required" });
    }
    if (!paymentForDate) {
      return res.status(400).json({ error: "paymentForDate is required" });
    }
    if (!paymentDate) {
      return res.status(400).json({ error: "paymentDate is required" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: "paymentMethod is required" });
    }
    if (totalRevenue === undefined || totalRevenue < 0) {
      return res.status(400).json({ error: "Valid totalRevenue is required" });
    }
    if (netPayable === undefined || netPayable < 0) {
      return res.status(400).json({ error: "Valid netPayable is required" });
    }
    if (ordersCompleted === undefined || ordersCompleted < 0) {
      return res.status(400).json({ error: "Valid ordersCompleted is required" });
    }
    if (platformFee === undefined || platformFee < 0) {
      return res.status(400).json({ error: "Valid platformFee is required" });
    }
    if (deliveryFee === undefined || deliveryFee < 0) {
      return res.status(400).json({ error: "Valid deliveryFee is required" });
    }
    if (taxes === undefined || taxes < 0) {
      return res.status(400).json({ error: "Valid taxes is required" });
    }

    // Validate netPayable calculation
    const calculatedNetPayable = totalRevenue - platformFee;
    if (Math.abs(calculatedNetPayable - netPayable) > 0.01) {
      return res.status(400).json({
        error: `Invalid netPayable: expected ${calculatedNetPayable}, received ${netPayable}`,
      });
    }

    // Validate paymentMethod against ConfirmedPayment schema enum
    const validPaymentMethods = ['cash', 'card', 'upi', 'wallet'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: `Invalid paymentMethod: ${paymentMethod}. Must be one of ${validPaymentMethods.join(', ')}`,
      });
    }

    // Validate dates
    const parsedPaymentForDate = new Date(paymentForDate);
    const parsedPaymentDate = new Date(paymentDate);
    if (isNaN(parsedPaymentForDate.getTime())) {
      return res.status(400).json({ error: "Invalid paymentForDate format" });
    }
    if (isNaN(parsedPaymentDate.getTime())) {
      return res.status(400).json({ error: "Invalid paymentDate format" });
    }
    const today = new Date();
    if (parsedPaymentDate > today) {
      return res.status(400).json({ error: "paymentDate cannot be in the future" });
    }

    // Validate restaurantId as ObjectId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: `Invalid restaurantId: ${restaurantId}` });
    }
    const restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);

    // Verify restaurant exists
    const restaurant = await Restaurant.findById(restaurantObjectId).lean();
    if (!restaurant) {
      return res.status(404).json({ error: `Restaurant with ID ${restaurantId} not found` });
    }

    // Fetch order to get restaurantName as fallback
    const order = await Order.findOne({ restaurantId: restaurantObjectId }).lean();
    const restaurantName = restaurant.name || order?.restaurantName || "Unknown";

    // Check for existing confirmed payment
    const existingConfirmed = await ConfirmedPayment.findOne({
      restaurantId: restaurantObjectId,
      paymentForDate: getStartOfDay(parsedPaymentForDate),
    }).lean();
    if (existingConfirmed) {
      return res.status(400).json({
        error: `Payment already confirmed for restaurant ${restaurantId} on ${paymentForDate}`,
      });
    }

    // Verify payments exist for the restaurant on the given date
    const startDate = getStartOfDay(parsedPaymentForDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    const orderIds = await Order.find({ restaurantId: restaurantObjectId }).distinct("orderId");
    const paymentCount = await Payment.countDocuments({
      createdAt: { $gte: startDate, $lt: endDate },
      paymentStatus: { $in: ["pending", "completed"] },
      orderId: { $in: orderIds },
    });
    if (paymentCount === 0) {
      return res.status(400).json({
        error: `No payments found for restaurant ${restaurantId} on ${paymentForDate}`,
      });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Create ConfirmedPayment document
        const confirmedPayment = new ConfirmedPayment({
          confirmPaymentId: uuidv4(),
          restaurantId: restaurantObjectId,
          restaurantName,
          paymentForDate: getStartOfDay(parsedPaymentForDate),
          paymentDate: getStartOfDay(parsedPaymentDate),
          paymentMethod,
          netPayable,
          ordersCompleted,
          platformFee,
          deliveryFee,
          taxes,
          confirmPaymentStatus: "completed",
          confirmedAt: new Date(),
        });

        await confirmedPayment.save({ session });

        // Update restaurantAdminTransactionStatus in Payment collection
        const updateResult = await Payment.updateMany(
          {
            createdAt: { $gte: startDate, $lt: endDate },
            orderId: { $in: orderIds },
            paymentStatus: { $in: ["pending", "completed"] },
          },
          { $set: { restaurantAdminTransactionStatus: "completed" } },
          { session }
        );

        console.log(`Updated ${updateResult.modifiedCount} Payment documents for restaurant ${restaurantId} on ${paymentForDate} to restaurantAdminTransactionStatus: completed`);

        res.json({
          message: `Payment confirmed for ${restaurantName} on ${paymentForDate}`,
          confirmedPayment: {
            confirmPaymentId: confirmedPayment.confirmPaymentId,
            restaurantId: confirmedPayment.restaurantId.toString(),
            restaurantName: confirmedPayment.restaurantName,
            paymentForDate: confirmedPayment.paymentForDate,
            paymentDate: confirmedPayment.paymentDate,
            paymentMethod: confirmedPayment.paymentMethod,
            netPayable: confirmedPayment.netPayable,
            ordersCompleted: confirmedPayment.ordersCompleted,
            platformFee: confirmedPayment.platformFee,
            deliveryFee: confirmedPayment.deliveryFee,
            taxes: confirmedPayment.taxes,
            confirmPaymentStatus: confirmedPayment.confirmPaymentStatus,
            confirmedAt: confirmedPayment.confirmedAt,
          },
        });
      });
    } catch (error) {
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Error in confirmPayment:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};