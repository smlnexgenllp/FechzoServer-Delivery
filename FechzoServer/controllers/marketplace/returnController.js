const mongoose = require("mongoose");

const MarketOrder = require("../../models/MarketPlace/MarketOrder");
const ReturnRequest = require("../../models/MarketPlace/ReturnRequest");

/* =====================================================
   CONFIG
===================================================== */

// Customer can request return within 7 days
// after delivery.
const RETURN_WINDOW_DAYS = 7;

/* =====================================================
   HELPERS
===================================================== */

const cleanId = (value) => {
  if (!value) return null;

  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
    return null;
  }

  return String(value);
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(
    String(value || "")
  );
};

/* =====================================================
   CHECK RETURN WINDOW
===================================================== */

const isWithinReturnWindow = (order) => {
  if (!order.deliveredAt) {
    return false;
  }

  const deliveredDate = new Date(order.deliveredAt);

  const returnDeadline = new Date(deliveredDate);

  returnDeadline.setDate(
    returnDeadline.getDate() + RETURN_WINDOW_DAYS
  );

  return new Date() <= returnDeadline;
};

/* =====================================================
   GET RETURN DEADLINE
===================================================== */

const getReturnDeadline = (order) => {
  if (!order?.deliveredAt) {
    return null;
  }

  const deadline = new Date(order.deliveredAt);

  deadline.setDate(
    deadline.getDate() + RETURN_WINDOW_DAYS
  );

  return deadline;
};

/* =====================================================
   CREATE RETURN REQUEST
   USER
===================================================== */

const createReturnRequest = async (req, res) => {
  try {
    const {
      orderId,
      orderItemId,
      quantity,
      reason,
      description = "",
      images = [],
    } = req.body;

    // ---------------------------------------------------
    // Validation
    // ---------------------------------------------------

    if (!orderId) {
      return res.status(400).json({
        error: "orderId is required",
      });
    }

    if (!orderItemId) {
      return res.status(400).json({
        error: "orderItemId is required",
      });
    }

    if (!isValidObjectId(orderItemId)) {
      return res.status(400).json({
        error: "Invalid orderItemId",
      });
    }

    if (!reason) {
      return res.status(400).json({
        error: "Return reason is required",
      });
    }

    const allowedReasons = [
      "Size/Fit issue",
      "Wrong product received",
      "Damaged product",
      "Defective product",
      "Product not as expected",
      "Missing item",
      "Other",
    ];

    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({
        error: "Invalid return reason",
      });
    }

    // ---------------------------------------------------
    // Find order
    // ---------------------------------------------------

    const order = await MarketOrder.findOne({
      $or: [
        {
          orderId: String(orderId),
        },
        ...(isValidObjectId(orderId)
          ? [{ _id: orderId }]
          : []),
      ],
    });

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    // ---------------------------------------------------
    // User validation
    // ---------------------------------------------------

    const requestUserId = cleanId(
      req.user?._id ||
        req.user?.id ||
        req.body.userId
    );

    if (
      requestUserId &&
      String(order.user) !== String(requestUserId)
    ) {
      return res.status(403).json({
        error: "You are not allowed to return this order",
      });
    }

    // ---------------------------------------------------
    // Order must be delivered
    // ---------------------------------------------------

    if (order.status !== "Delivered") {
      return res.status(400).json({
        error:
          "Return request can only be created after the order is delivered",
      });
    }

    // ---------------------------------------------------
    // Return window
    // ---------------------------------------------------
    if (!order.deliveredAt) {
      return res.status(400).json({
        error: "Delivery date is not available for this order.",
      });
    }
    if (!isWithinReturnWindow(order)) {
      return res.status(400).json({
        error: `Return window of ${RETURN_WINDOW_DAYS} days has expired`,
        returnDeadline: getReturnDeadline(order),
      });
    }

    // ---------------------------------------------------
    // Find exact item
    // ---------------------------------------------------

    const orderItem = order.items.find(
      (item) =>
        String(item.itemId) ===
        String(orderItemId)
    );

    if (!orderItem) {
      return res.status(404).json({
        error: "Order item not found",
      });
    }

    // ---------------------------------------------------
    // Quantity
    // ---------------------------------------------------

    const requestedQuantity =
      Number(quantity) || 1;

    if (requestedQuantity < 1) {
      return res.status(400).json({
        error: "Invalid return quantity",
      });
    }

    if (
      requestedQuantity >
      Number(orderItem.quantity)
    ) {
      return res.status(400).json({
        error:
          "Return quantity cannot exceed ordered quantity",
      });
    }

    // ---------------------------------------------------
    // Existing return quantity
    // ---------------------------------------------------

    const existingReturns =
      await ReturnRequest.find({
        order: order._id,
        orderItemId: orderItem.itemId,
        status: {
          $nin: [
            "Rejected",
            "Cancelled",
          ],
        },
      }).lean();

    const alreadyReturnedQuantity =
      existingReturns.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0),
        0
      );

    const remainingQuantity =
      Number(orderItem.quantity) -
      alreadyReturnedQuantity;

    if (
      requestedQuantity >
      remainingQuantity
    ) {
      return res.status(400).json({
        error:
          "Requested return quantity exceeds remaining returnable quantity",
        remainingQuantity,
      });
    }

    // ---------------------------------------------------
    // Price
    // ---------------------------------------------------

    const itemPrice =
      Number(orderItem.price || 0);

    const refundAmount =
      Math.round(
        itemPrice *
          requestedQuantity *
          100
      ) / 100;

    // ---------------------------------------------------
    // Create return
    // ---------------------------------------------------

    const returnRequest =
      await ReturnRequest.create({
        order: order._id,

        orderId: order.orderId,

        user: order.user,

        store: order.store,

        orderItemId: orderItem.itemId,

        product: orderItem.product,

        variant: orderItem.variant || null,

        productName: orderItem.name,

        productImage:
          orderItem.image || "",

        sku: orderItem.sku || "",

        attributes:
          orderItem.attributes || {},

        quantity: requestedQuantity,

        itemPrice,

        refundAmount,

        reason,

        description,

        images: Array.isArray(images)
          ? images
          : [],

        status: "Requested",

        refundStatus: "Pending",

        requestedAt: new Date(),
      });

    return res.status(201).json({
      message:
        "Return request submitted successfully",

      returnRequest,
    });
  } catch (error) {
    console.error(
      "Create Return Request Error:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Internal server error",
    });
  }
};

/* =====================================================
   GET USER RETURN REQUESTS
===================================================== */

const getUserReturnRequests = async (
  req,
  res
) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        error: "Invalid userId",
      });
    }

    const returns =
      await ReturnRequest.find({
        user: userId,
      })
        .sort({
          createdAt: -1,
        })
        .populate(
          "product",
          "name thumbnail images"
        )
        .populate(
          "store",
          "storeName name logo"
        )
        .lean();

    return res.status(200).json({
      returns,
    });
  } catch (error) {
    console.error(
      "Get User Return Requests Error:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

/* =====================================================
   GET SINGLE RETURN REQUEST
===================================================== */

const getReturnRequestById = async (
  req,
  res
) => {
  try {
    const { returnId } = req.params;

    if (!isValidObjectId(returnId)) {
      return res.status(400).json({
        error: "Invalid return request ID",
      });
    }

    const returnRequest =
      await ReturnRequest.findById(
        returnId
      )
        .populate(
          "product",
          "name thumbnail images"
        )
        .populate(
          "store",
          "storeName name logo"
        )
        .populate(
          "user",
          "name email phone"
        )
        .lean();

    if (!returnRequest) {
      return res.status(404).json({
        error:
          "Return request not found",
      });
    }

    return res.status(200).json({
      returnRequest,
    });
  } catch (error) {
    console.error(
      "Get Return Request Error:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

/* =====================================================
   CANCEL RETURN REQUEST
   USER
===================================================== */

const cancelReturnRequest = async (
  req,
  res
) => {
  try {
    const { returnId } = req.params;

    if (!isValidObjectId(returnId)) {
      return res.status(400).json({
        error: "Invalid return request ID",
      });
    }

    const returnRequest =
      await ReturnRequest.findById(
        returnId
      );

    if (!returnRequest) {
      return res.status(404).json({
        error:
          "Return request not found",
      });
    }

    if (
      ![
        "Requested",
        "Approved",
      ].includes(
        returnRequest.status
      )
    ) {
      return res.status(400).json({
        error:
          "Return request cannot be cancelled at this stage",
      });
    }

    returnRequest.status =
      "Cancelled";

    returnRequest.cancelledAt =
      new Date();

    await returnRequest.save();

    return res.status(200).json({
      message:
        "Return request cancelled successfully",

      returnRequest,
    });
  } catch (error) {
    console.error(
      "Cancel Return Request Error:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

/* =====================================================
   GET STORE RETURN REQUESTS
===================================================== */

const getStoreReturnRequests = async (
  req,
  res
) => {
  try {
    const { storeId } = req.params;

    if (!isValidObjectId(storeId)) {
      return res.status(400).json({
        error: "Invalid storeId",
      });
    }

    const {
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {
      store: storeId,
    };

    if (status) {
      filter.status = status;
    }

    const pageNumber =
      Math.max(Number(page) || 1, 1);

    const limitNumber =
      Math.min(
        Math.max(
          Number(limit) || 20,
          1
        ),
        100
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    const [
      returns,
      total,
    ] = await Promise.all([
      ReturnRequest.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limitNumber)
        .populate(
          "user",
          "name phone email"
        )
        .populate(
          "product",
          "name thumbnail"
        )
        .lean(),

      ReturnRequest.countDocuments(
        filter
      ),
    ]);

    return res.status(200).json({
      returns,

      pagination: {
        total,

        page: pageNumber,

        limit: limitNumber,

        pages: Math.ceil(
          total / limitNumber
        ),
      },
    });
  } catch (error) {
    console.error(
      "Get Store Return Requests Error:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

/* =====================================================
   UPDATE RETURN STATUS
   STORE / ADMIN
===================================================== */

const updateReturnStatus = async (
  req,
  res
) => {
  try {
    const { returnId } = req.params;

    const {
      status,
      rejectionReason,
      adminNote,
      refundMethod,
      refundReference,
    } = req.body;

    const allowedStatuses = [
      "Requested",
      "Approved",
      "Rejected",
      "Pickup Scheduled",
      "Picked Up",
      "Received",
      "Refunded",
      "Cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error:
          "Invalid return status",
      });
    }

    if (!isValidObjectId(returnId)) {
      return res.status(400).json({
        error:
          "Invalid return request ID",
      });
    }

    const returnRequest =
      await ReturnRequest.findById(
        returnId
      );

    if (!returnRequest) {
      return res.status(404).json({
        error:
          "Return request not found",
      });
    }

    // ---------------------------------------------------
    // REJECT
    // ---------------------------------------------------

    if (status === "Rejected") {
      if (!rejectionReason) {
        return res.status(400).json({
          error:
            "Rejection reason is required",
        });
      }

      returnRequest.rejectionReason =
        rejectionReason;

      returnRequest.rejectedAt =
        new Date();
    }

    // ---------------------------------------------------
    // APPROVED
    // ---------------------------------------------------

    if (status === "Approved") {
      returnRequest.approvedAt =
        new Date();

      returnRequest.refundStatus =
        "Pending";
    }

    // ---------------------------------------------------
    // PICKED UP
    // ---------------------------------------------------

    if (status === "Picked Up") {
      returnRequest.pickedUpAt =
        new Date();
    }

    // ---------------------------------------------------
    // RECEIVED
    // ---------------------------------------------------

    if (status === "Received") {
      returnRequest.receivedAt =
        new Date();
    }

    // ---------------------------------------------------
    // REFUNDED
    // ---------------------------------------------------

    if (status === "Refunded") {
      returnRequest.refundStatus =
        "Completed";

      returnRequest.refundedAt =
        new Date();

      if (refundMethod) {
        returnRequest.refundMethod =
          refundMethod;
      }

      if (refundReference) {
        returnRequest.refundReference =
          refundReference;
      }
    }

    // ---------------------------------------------------
    // Notes
    // ---------------------------------------------------

    if (adminNote !== undefined) {
      returnRequest.adminNote =
        adminNote;
    }

    returnRequest.status =
      status;

    await returnRequest.save();

    // ---------------------------------------------------
    // Update parent order status
    // ---------------------------------------------------

    if (status === "Refunded") {
      const order =
        await MarketOrder.findById(
          returnRequest.order
        );

      if (order) {
        const allItemsReturned =
          await ReturnRequest.countDocuments(
            {
              order: order._id,
              status: {
                $nin: [
                  "Rejected",
                  "Cancelled",
                ],
              },
            }
          );

        const totalItems =
          order.items.length;

        if (
          allItemsReturned >=
          totalItems
        ) {
          order.status =
            "Refunded";

          order.paymentStatus =
            "Refunded";

          await order.save();
        }
      }
    }

    return res.status(200).json({
      message:
        "Return status updated successfully",

      returnRequest,
    });
  } catch (error) {
    console.error(
      "Update Return Status Error:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

/* =====================================================
   EXPORT
===================================================== */

module.exports = {
  createReturnRequest,
  getUserReturnRequests,
  getReturnRequestById,
  cancelReturnRequest,
  getStoreReturnRequests,
  updateReturnStatus,
};