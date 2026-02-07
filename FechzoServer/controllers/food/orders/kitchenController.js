const Order = require("../../../models/order/order");
const Payment = require("../../../models/order/payment");
const Restaurant = require("../../../models/restaurants/shops/RestaurantDetails");
const notificationController = require("../../restaurants/notificationController");

// Utility to map order with payment details
function mapOrder(order, payment = null) {
  return {
    id: order._id,
    orderNumber: order.orderId,
    customer: order.selectedAddress?.name || "N/A",
    phone: order.selectedAddress?.phone || "N/A",
    selectedAddress: order.selectedAddress
      ? {
          fullAddress: order.selectedAddress.address || "N/A",
          name: order.selectedAddress.name || "N/A",
          phone: order.selectedAddress.phone || "N/A",
          pincode: order.selectedAddress.pincode || "N/A",
          city: order.selectedAddress.city || "N/A",
          state: order.selectedAddress.state || "N/A",
        }
      : {
          fullAddress: "N/A",
          name: "N/A",
          phone: "N/A",
          pincode: "N/A",
          city: "N/A",
          state: "N/A",
        },
    items: order.cartItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      addons: (item.addons || []).map((addon) => ({
        name: addon.name,
        quantity: addon.quantity,
        price: addon.price,
      })),
      unit: item.unit,
      specialInstructions: item.specialInstructions,
    })),
    total: order.total,
    status: order.orderStatus,
    createdAt: order.createdAt
      ? order.createdAt.toISOString()
      : new Date().toISOString(),
    specialInstructions: order.specialInstructions,
    paymentMethod: payment
      ? payment.paymentMethod
      : order.paymentMethod || "N/A",
    paymentStatus: payment ? payment.paymentStatus : "N/A",
    paymentId: payment ? payment.paymentId : "N/A",
    restaurantAdminTransactionStatus: payment
      ? payment.restaurantAdminTransactionStatus
      : "N/A",
    orderSummary: payment ? payment.orderSummary : [], // Include orderSummary from Payment model
    appliedOffers: payment ? payment.appliedOffers : [], // Add this line
    cancellationReason: order.cancellationReason || "",
    time: order.createdAt
      ? order.createdAt.toISOString()
      : new Date().toISOString(),
  };
}

exports.getKitchenOrders = async (req, res) => {
  try {
    const restaurantId = req.headers["restaurant-id"];
    if (!restaurantId) {
      return res
        .status(400)
        .json({ success: false, message: "Restaurant ID is required" });
    }

    const orders = await Order.find({ restaurantId, orderStatus: "placed" })
      .select([
        "orderId",
        "cartItems",
        "selectedAddress",
        "total",
        "orderStatus",
        "createdAt",
        "specialInstructions",
        "paymentMethod",
        "appliedOffers" // Add this line
      ]);

    // Fetch payment details for each order
    const mappedOrders = await Promise.all(
      orders.map(async (order) => {
        const payment = await Payment.findOne({ orderId: order.orderId })
          .populate('appliedOffers.offerId'); // Add this line to populate offer details
        return mapOrder(order, payment);
      })
    );

    res.json({ success: true, data: mappedOrders });
  } catch (error) {
    console.error("Error fetching kitchen orders:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message
    });
  }
};

// Update the valid statuses in getAllOrders
exports.getAllOrders = async (req, res) => {
  try {
    const restaurantId = req.headers["restaurant-id"];
    if (!restaurantId) {
      return res
        .status(400)
        .json({ success: false, message: "Restaurant ID is required" });
    }

    const orders = await Order.find({
      restaurantId,
      orderStatus: {
        $in: [
          "preparing",
          "ready",
          "pickedUp",
          "arrivingSoon",
          "delivered",
          "cancelled",
        ],
      },
    })
      .sort({ createdAt: -1 })
      .select([
        "orderId",
        "cartItems",
        "selectedAddress",
        "total",
        "orderStatus",
        "createdAt",
        "specialInstructions",
        "paymentMethod",
        "cancellationReason",
      ]);

    // Fetch payment details for each order
    const mappedOrders = await Promise.all(
      orders.map(async (order) => {
        const payment = await Payment.findOne({ orderId: order.orderId });
        return mapOrder(order, payment);
      })
    );

    res.json({ success: true, data: mappedOrders });
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: error.message,
    });
  }
};

// Update order status (unchanged)
exports.updateKitchenOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, cancellationReason } = req.body;
    const restaurantId = req.headers["restaurant-id"];

    if (!restaurantId) {
      return res
        .status(400)
        .json({ success: false, message: "Restaurant ID is required" });
    }

    // Update valid status array
    if (
      ![
        "preparing",
        "ready",
        "pickedUp",
        "arrivingSoon",
        "delivered",
        "cancelled",
      ].includes(status)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    if (
      status === "cancelled" &&
      (!cancellationReason || cancellationReason.trim() === "")
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Cancellation reason is required" });
    }

    const updateFields = { orderStatus: status };
    if (status === "cancelled") {
      updateFields.cancellationReason = cancellationReason;
    }

    const order = await Order.findOneAndUpdate(
      { orderId, restaurantId },
      updateFields,
      { new: true }
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Update payment status for cash payments when order is delivered
    if (status === "delivered") {
      const payment = await Payment.findOne({ orderId: order.orderId });

      if (payment && payment.paymentMethod === "cash") {
        await Payment.findOneAndUpdate(
          { orderId: order.orderId },
          {
            paymentStatus: "completed",
            // Also update the restaurantAdminTransactionStatus
            restaurantAdminTransactionStatus: "completed",
          },
          { new: true }
        );
        console.log(
          `Payment status updated to completed for cash order #${orderId}`
        );
      }
    }

    // Fetch updated payment details
    const updatedPayment = await Payment.findOne({ orderId: order.orderId });

    const io = req.app.get("io");
    const notificationData = {
      restaurantId: order.restaurantId,
      type: `order_${status}`,
      title: "Order Status Updated",
      message: getStatusMessage(status, order.orderId),
      details: { orderId: order.orderId, status, updatedAt: new Date() },
      priority: getPriorityForStatus(status),
      icon: getIconForStatus(status),
    };

    const notification = await notificationController.createNotification(
      notificationData
    );

    if (io) {
      io.to(order.restaurantId.toString()).emit("orderStatusUpdate", {
        orderId: order.orderId,
        status,
        notification,
      });
      if (status !== "placed") {
        io.to(restaurantId).emit("ORDER_REMOVED", {
          type: "ORDER_REMOVED",
          orderNumber: order.orderId,
        });
      }
      io.to(restaurantId).emit("ORDER_STATUS_UPDATED", {
        type: "ORDER_STATUS_UPDATED",
        order: mapOrder(order, updatedPayment),
      });
    }

    res.json({
      success: true,
      data: mapOrder(order, updatedPayment),
    });
  } catch (error) {
    console.error(`Error updating kitchen order status:`, error);
    res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: error.message,
    });
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const restaurantId = req.headers["restaurant-id"];
    if (!restaurantId) {
      return res
        .status(400)
        .json({ success: false, message: "Restaurant ID is required" });
    }

    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid date format" });
    }

    end.setHours(23, 59, 59, 999);

    // Fetch orders
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orders = await Order.find({
      restaurantId,
      createdAt: { $gte: start, $lte: end },
      orderStatus: {
        $in: [
          "placed",
          "preparing",
          "ready",
          "pickedUp",
          "arrivingSoon",
          "delivered",
          "cancelled",
        ],
      },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select([
        "orderId",
        "cartItems",
        "selectedAddress",
        "total",
        "orderStatus",
        "createdAt",
        "specialInstructions",
        "paymentMethod",
        "cancellationReason",
      ]);

    // Compute aggregated stats
    const allOrders = await Order.find({
      restaurantId,
      createdAt: { $gte: start, $lte: end },
      orderStatus: {
        $in: [
          "placed",
          "preparing",
          "ready",
          "pickedUp",
          "arrivingSoon",
          "delivered",
          "cancelled",
        ],
      },
    });

    // Update stats calculation
    const stats = {
      totalOrders: allOrders.length,
      completedCount: allOrders.filter(
        (order) => order.orderStatus === "delivered"
      ).length,
      cancelledCount: allOrders.filter(
        (order) => order.orderStatus === "cancelled"
      ).length,
      totalRevenue: allOrders
        .filter((order) => order.orderStatus === "delivered")
        .reduce((sum, order) => sum + (order.total || 0), 0),
    };

    const totalOrders = await Order.countDocuments({
      restaurantId,
      createdAt: { $gte: start, $lte: end },
      orderStatus: {
        $in: [
          "placed",
          "preparing",
          "ready",
          "pickedUp",
          "arrivingSoon",
          "delivered",
          "cancelled",
        ],
      },
    });

    // Map orders with payment details
    const mappedOrders = await Promise.all(
      orders.map(async (order) => {
        const payment = await Payment.findOne({ orderId: order.orderId });
        return mapOrder(order, payment);
      })
    );

    console.log(
      `getOrderHistory: Fetched ${mappedOrders.length} orders for restaurant ${restaurantId}, stats:`,
      stats
    );

    res.json({
      success: true,
      data: mappedOrders,
      pagination: {
        totalOrders,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / parseInt(limit)),
        limit: parseInt(limit),
      },
      stats, // Include computed stats
    });
  } catch (error) {
    console.error("Error fetching order history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching order history",
      error: error.message,
    });
  }
};

// Update the getRestaurantDetailsForOrder function
exports.getRestaurantDetailsForOrder = async (req, res) => {
  try {
    const { orderId } = req.params; // Change from restaurantId to orderId

    // First find the order to get restaurantId
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Then find restaurant details using restaurantId from order
    const restaurant = await Restaurant.findOne(
      { _id: order.restaurantId },
      {
        restaurantName: 1,
        restaurantAddress: 1,
        numbers: 1,
        restaurantId: 1,
        gstNumber: 1,
        fssaiNumber: 1,
      }
    );

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    const restaurantDetails = {
      name: restaurant.restaurantName,
      address: {
        shopNumber: restaurant.restaurantAddress.shopNumber || "",
        area: restaurant.restaurantAddress.area || "",
        city: restaurant.restaurantAddress.city || "",
        state: restaurant.restaurantAddress.state || "",
        pincode: restaurant.restaurantAddress.postalCode || "",
        landmark: restaurant.restaurantAddress.landmark || "",
      },
      contact: restaurant.ownerDetails.phone || null,
      registrationNumber: restaurant.restaurantId || "",
      gstNumber: restaurant.gstNumber || "",
      fssaiNumber: restaurant.fssaiNumber || "",
    };

    res.json({
      success: true,
      data: restaurantDetails,
    });
  } catch (error) {
    console.error("Error fetching restaurant details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching restaurant details",
      error: error.message,
    });
  }
};

// Add these helper functions at the end of the file
function getStatusMessage(status, orderId) {
  const messages = {
    preparing: `Order #${orderId} is now being prepared`,
    ready: `Order #${orderId} is ready for pickUp`,
    pickedUp: `Order #${orderId} has been picked up`,
    arrivingSoon: `Order #${orderId} is arriving soon`,
    delivered: `Order #${orderId} has been delivered`,
    cancelled: `Order #${orderId} has been cancelled`,
  };
  return messages[status] || `Order #${orderId} status changed to ${status}`;
}

function getPriorityForStatus(status) {
  const priorities = {
    cancelled: "high",
    delivered: "low",
    arrivingSoon: "medium",
    ready: "high",
    preparing: "medium",
    pickedUp: "medium",
  };
  return priorities[status] || "medium";
}

function getIconForStatus(status) {
  const icons = {
    preparing: "FaKitchenSet",
    ready: "FaCheckCircle",
    pickedUp: "FaMotorcycle",
    arrivingSoon: "FaTruckFast",
    delivered: "FaCircleCheck",
    cancelled: "FaTimesCircle",
  };
  return icons[status] || "FaCircleInfo";
}
