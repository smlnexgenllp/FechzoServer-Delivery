const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const Order = require("../../models/order/order");
const Counter = mongoose.model("Counter");
const crypto = require("crypto");
const Cart = require("../../models/restaurants/CartModel");
const Payment = require("../../models/order/payment");
const notificationController = require("../../controllers/restaurants/notificationController");
const Offer = require("../../models/offers/Offer");
const AdminOffer = require("../../models/offers/AdminOffer");
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getNextSequence = async (name) => {
  try {
    console.log(`Generating sequence for ${name}`);
    const counter = await Counter.findOneAndUpdate(
      { _id: name },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );
    console.log(`Sequence generated: ${counter.sequence}`);
    return counter.sequence;
  } catch (err) {
    console.error(`Failed to generate sequence for ${name}:`, err);
    throw new Error(`Failed to generate sequence for ${name}: ${err.message}`);
  }
};

const generateOrderId = async () => {
  console.log("Generating order ID");
  const sequence = await getNextSequence("orderId");
  const orderId = `ORD${String(sequence).padStart(3, "0")}`;
  console.log(`Order ID generated: ${orderId}`);
  return orderId;
};

const generatePaymentId = async () => {
  console.log("Generating payment ID");
  const sequence = await getNextSequence("paymentId");
  const paymentId = `PAY${String(sequence).padStart(3, "0")}`;
  console.log(`Payment ID generated: ${paymentId}`);
  return paymentId;
};

exports.getRazorpayKey = (req, res) => {
  try {
    console.log("Fetching Razorpay key");
    if (!process.env.RAZORPAY_KEY_ID) {
      throw new Error("Razorpay key not configured");
    }
    console.log("Razorpay key fetched successfully");
    res.json({ key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("Error fetching Razorpay key:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch Razorpay key", details: err.message });
  }
};

exports.createOrder = async (req, res) => {
  const {
    amount,
    paymentMethod,
    cartItems,
    selectedAddress,
    userId,
    upiId,
    itemsTotal,
    discount,
    deliveryCharge,
    packingCharge,
    platformFee,
    cgst,
    sgst,
    appliedPromoCode,
    selectedOffer
  } = req.body;

  try {
    // ----------------- INPUT VALIDATION -----------------
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (!["cash","cards","upi","wallets"].includes(paymentMethod)) return res.status(400).json({ error: "Invalid payment method" });
    if (!userId) return res.status(400).json({ error: "User ID is required" });
    if (!cartItems?.length) return res.status(400).json({ error: "Cart items are required" });
    if (!selectedAddress?.address || !selectedAddress?.phone) return res.status(400).json({ error: "Valid address is required" });
    if (paymentMethod === "upi" && !upiId?.match(/^[\w.-]+@[\w.-]+$/)) return res.status(400).json({ error: "Valid UPI ID is required for UPI payments" });

    // Validate numeric fields
    const numericFields = { itemsTotal, deliveryCharge, packingCharge, platformFee, cgst, sgst, discount: discount || 0 };
    for (const [key, value] of Object.entries(numericFields)) {
      if (isNaN(parseFloat(value))) return res.status(400).json({ error: `Invalid ${key}` });
    }

    if (paymentMethod === "cash" && amount < 100)
      return res.status(400).json({ error: "Cash on delivery not available for orders below ₹100" });

    // ----------------- CALCULATE GRAND TOTAL -----------------
    const calculatedGrandTotal = (
      parseFloat(itemsTotal) - parseFloat(discount || 0) +
      parseFloat(deliveryCharge) + parseFloat(packingCharge) +
      parseFloat(platformFee) + parseFloat(cgst) + parseFloat(sgst)
    ).toFixed(2);

    if (parseFloat(amount).toFixed(2) !== calculatedGrandTotal) {
      return res.status(400).json({
        error: "Provided amount does not match calculated grand total",
        details: `Expected: ${calculatedGrandTotal}, Received: ${amount}`
      });
    }

    // ----------------- GET RESTAURANT FROM CART ITEMS -----------------
    const restaurantId = cartItems[0]?.restaurantId || cartItems[0]?.restaurant_id;
    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID missing from cart items" });
    }

    const restaurant = await mongoose.model("Restaurant").findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // ----------------- VALIDATE DELIVERY LOCATION -----------------
    let lat, lng;

    if (selectedAddress.coords) {
      lat = Number(selectedAddress.coords?.lat);
      lng = Number(selectedAddress.coords?.lng);
    } else if (selectedAddress.latitude && selectedAddress.longitude) {
      lat = Number(selectedAddress.latitude);
      lng = Number(selectedAddress.longitude);
    } else {
      return res.status(400).json({
        error: "Delivery coordinates are missing",
        details: "Expected coords.lat/lng or latitude/longitude in selectedAddress"
      });
    }

    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        error: "Invalid delivery location coordinates",
        received: { lat, lng }
      });
    }

    const deliveryLocation = {
      type: "Point",
      coordinates: [lng, lat]  // longitude first!
    };

    console.log("Selected Address received:", selectedAddress);
    console.log("Parsed coordinates:", { lat, lng });

    // ----------------- CONSTRUCT ORDER SUMMARY -----------------
    const orderSummary = cartItems.map(item => {
      const itemTotal = item.price * item.quantity;
      const addonTotal = item.addons?.reduce((sum, a) => sum + (a.price || 0) * (a.quantity || 0), 0) || 0;
      return { type: "item", id: item.id, totalCost: (itemTotal + addonTotal).toFixed(2) };
    });
    orderSummary.push({ type: "itemsTotal", value: itemsTotal });
    if (discount && parseFloat(discount) > 0) {
      const discountEntry = { type: "discount", value: discount };
      if (appliedPromoCode?.trim()) discountEntry.promoCode = appliedPromoCode;
      orderSummary.push(discountEntry);
    }
    orderSummary.push({ type: "deliveryCharge", value: deliveryCharge });
    orderSummary.push({ type: "packingCharge", value: packingCharge });
    orderSummary.push({ type: "platformFee", value: platformFee });
    orderSummary.push({ type: "cgst", value: cgst });
    orderSummary.push({ type: "sgst", value: sgst });
    orderSummary.push({ type: "grandTotal", value: calculatedGrandTotal });

    // ----------------- GENERATE ORDER & PAYMENT IDS -----------------
    const orderId = await generateOrderId();
    const paymentId = await generatePaymentId();

    // ----------------- PROCESS APPLIED OFFERS -----------------
    const appliedOffers = [];

    // ... (your existing offer processing logic remains unchanged)
    // Promo Code + Selected Offer logic here ...

    // ----------------- CREATE ORDER DOCUMENT -----------------
    const orderData = {
      orderId,
      userId,
      cartItems,
      total: amount,
      selectedAddress,
      restaurantId: restaurant._id,
      restaurantName: restaurant.restaurantName || "Restaurant",
      restaurantImage: restaurant.images?.profile || "",
      deliveryLocation,
    };

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = new Order(orderData);
      await order.save({ session });

      if (appliedOffers.length > 0) {
        await updateOfferAnalytics(appliedOffers, restaurant._id, req);
      }

      // ----------------- CREATE PAYMENT DOCUMENT -----------------
      const paymentData = {
        paymentId,
        orderId,
        paymentMethod,
        paymentStatus: "pending",
        upiId: paymentMethod === "upi" ? upiId : undefined,
        orderSummary,
        appliedOffers
      };

      let razorpayOrder = null;

      // Razorpay order for non-cash payments
      if (paymentMethod !== "cash") {
        const options = { 
          amount: Math.round(parseFloat(amount) * 100), 
          currency: "INR", 
          receipt: `receipt_${orderId}_${Date.now()}` 
        };
        razorpayOrder = await razorpayInstance.orders.create(options);
        paymentData.razorpayOrderId = razorpayOrder.id;
      }

      const payment = new Payment(paymentData);
      await payment.save({ session });

      // Clear cart if cash (safe even if no cart)
      if (paymentMethod === "cash") {
        await Cart.deleteOne({ userId });
      }

      await session.commitTransaction();
      session.endSession();

      // ────────────────────────────────────────────────
      //          UPDATED RESPONSE PAYLOAD
      // ────────────────────────────────────────────────
      const responsePayload = {
        success: true,
        orderId,                    // your custom ORDxxx
        paymentId,
        message: paymentMethod === "cash" 
          ? "Cash order placed successfully" 
          : "Razorpay order created – ready for payment",
      };

      // Add Razorpay fields only for online payments
      if (paymentMethod !== "cash" && razorpayOrder) {
        responsePayload.id = razorpayOrder.id;                    // ← frontend expects this
        responsePayload.razorpayOrderId = razorpayOrder.id;       // ← more explicit name
        responsePayload.amount = razorpayOrder.amount;            // in paise
        responsePayload.currency = razorpayOrder.currency;
      }

      console.log("createOrder → sending to frontend:", responsePayload);

      res.json(responsePayload);

    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(500).json({ 
      error: "Failed to create order", 
      details: err.message || "Unknown error" 
    });
  }
};
exports.verifyPayment = async (req, res) => {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    orderId,
  } = req.body;

  try {
    console.log("Starting payment verification with body:", req.body);

    // Validate input
    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !orderId
    ) {
      console.log("Missing payment verification details");
      return res
        .status(400)
        .json({ error: "Missing required payment verification details" });
    }

    // Verify Razorpay signature
    console.log("Verifying Razorpay signature");
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.log(
        "Invalid payment signature. Expected:",
        expectedSignature,
        "Received:",
        razorpay_signature
      );
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature" });
    }
    console.log("Razorpay signature verified");

    // Fetch payment details from Razorpay
    let cardholderName = undefined;
    let cardExpiry = undefined;
    console.log(
      "Fetching Razorpay payment details for payment:",
      razorpay_payment_id
    );
    try {
      const paymentDetails = await razorpayInstance.payments.fetch(
        razorpay_payment_id
      );
      console.log("Razorpay payment details:", paymentDetails);
      if (paymentDetails.method === "card") {
        cardholderName = paymentDetails.card?.name || undefined;
        cardExpiry =
          paymentDetails.card?.expiry_month && paymentDetails.card?.expiry_year
            ? `${
                paymentDetails.card.expiry_month
              }/${paymentDetails.card.expiry_year.toString().slice(-2)}`
            : undefined;
        console.log("Card details fetched:", { cardholderName, cardExpiry });
      }
    } catch (err) {
      console.error("Error fetching Razorpay payment details:", err);
      // Continue with payment verification even if card details fetch fails
    }

    const session = await mongoose.startSession();
    console.log("Mongoose session started for payment verification");
    session.startTransaction();
    try {
      // Update Payment document
      console.log("Updating payment for order:", orderId);
      const payment = await Payment.findOneAndUpdate(
        { orderId },
        {
          razorpayPaymentId: razorpay_payment_id,
          paymentStatus: "completed",
          cardholderName: cardholderName,
          cardExpiry: cardExpiry,
        },
        { new: true, session }
      );

      if (!payment) {
        console.log("Payment record not found for order:", orderId);
        return res
          .status(404)
          .json({ success: false, message: "Payment record not found" });
      }
      console.log("Payment updated:", payment.paymentId);

      // Update Order document
      console.log("Updating order:", orderId);
      const order = await Order.findOneAndUpdate(
        { orderId },
        { orderStatus: "placed" },
        { new: true, session }
      );

      if (!order) {
        console.log("Order not found:", orderId);
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      console.log("Order updated:", orderId);

      // Clear the cart
      console.log("Deleting cart for user:", order.userId);
      await Cart.findOneAndDelete({ userId: order.userId }, { session });
      console.log("Cart deleted");

      // Create and send notification
      if (req.app.get("io")) {
        console.log(
          "Creating notification for restaurant:",
          order.restaurantId
        );
        const notificationData = {
          restaurantId: order.restaurantId,
          type: "order_placed",
          title: "New Order Placed",
          message: `Order #${order.orderId} placed worth ₹${order.total}`,
          details: {
            orderId: order.orderId,
            customer: {
              name: order.selectedAddress?.name || "Customer",
              phone: order.selectedAddress?.phone || "N/A",
            },
            items: order.cartItems,
            total: order.total,
            paymentMethod: payment.paymentMethod,
          },
          priority: "high", // Ensure this is set to high
          icon: "FaShoppingBag",
          sound: true // Add this flag
        };
        console.log("Notification data:", notificationData);

        const notification = await notificationController.createNotification(
          notificationData
        );
        console.log("Notification created:", notification);
        const io = req.app.get("io");
        io.to(order.restaurantId.toString()).emit("newOrder", {
          ...order.toObject(),
          notification,
          priority: "high", // Add priority here too
          sound: true
        });
        console.log("Notification emitted to restaurant:", order.restaurantId);
      }

      // Emit new order event
      if (req.app.get("io")) {
        const io = req.app.get("io");
        io.to(order.restaurantId.toString()).emit("kitchen_new_order", {
          id: order._id,
          orderNumber: order.orderId,
          createdAt: order.createdAt,
          total: order.total,
          selectedAddress: {
            name: order.selectedAddress?.name || "N/A",
            fullAddress: order.selectedAddress?.address || "N/A",
            phone: order.selectedAddress?.phone || "N/A",
            city: order.selectedAddress?.city || "N/A",
            pincode: order.selectedAddress?.pincode || "N/A",
          },
          items: order.cartItems.map((item) => ({
            quantity: item.quantity,
            name: item.name,
            price: item.price,
            addons: item.addons || [],
            specialInstructions: item.specialInstructions,
          })),
          paymentMethod: payment.paymentMethod,
          paymentStatus: payment.paymentStatus,
          orderSummary: payment.orderSummary,
          appliedOffers: payment.appliedOffers.map(offer => ({
            offerId: offer.offerId,
            offerType: offer.offerType,
            promoCode: offer.promoCode,
            discountAmount: offer.discountAmount,
            freeItems: offer.freeItems || [],
            appliedAt: offer.appliedAt
          })),
          status: order.orderStatus,
        });
      }

      console.log("Committing transaction for payment verification");
      await session.commitTransaction();
      console.log("Transaction committed");

      console.log("Payment verified successfully for order:", orderId);
      res.json({
        success: true,
        message: "Payment verified successfully, cart cleared",
        orderId,
        paymentId: payment.paymentId,
      });
    } catch (err) {
      console.error("Transaction error in payment verification:", err);
      await session.abortTransaction();
      console.log("Transaction aborted");
      throw err;
    } finally {
      console.log("Ending Mongoose session");
      session.endSession();
    }
  } catch (err) {
    console.error("Payment verification failed:", err.stack);
    res
      .status(500)
      .json({
        error: "Payment verification failed",
        details: err.message || "Unknown error",
      });
  }
};

exports.getOrderById = async (req, res) => {
  const orderId = req.params.orderId;

  try {
    console.log("Fetching order by ID:", orderId);
    if (!orderId) {
      console.log("Order ID missing");
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Fetch Order and Payment documents
    console.log("Querying Order and Payment documents");
    const order = await Order.findOne({ orderId }).populate("userId", "email");
    const payment = await Payment.findOne({ orderId });

    if (!order) {
      console.log("Order not found:", orderId);
      return res.status(404).json({ error: "Order not found" });
    }
    console.log("Order fetched:", orderId);

    // Combine order and payment data
    const response = {
      ...order.toObject(),
      paymentId: payment?.paymentId,
      paymentMethod: payment?.paymentMethod,
      paymentStatus: payment?.paymentStatus,
      razorpayOrderId: payment?.razorpayOrderId,
      razorpayPaymentId: payment?.razorpayPaymentId,
      upiId: payment?.upiId,
      cardholderName: payment?.cardholderName,
      cardExpiry: payment?.cardExpiry,
      cardToken: payment?.cardToken,
      orderSummary: payment?.orderSummary,
    };
    console.log("Order response prepared:", response);

    res.json(response);
  } catch (err) {
    console.error("Error fetching order:", err.stack);
    res
      .status(500)
      .json({
        error: "Failed to fetch order",
        details: err.message || "Unknown error",
      });
  }
};

// Helper function to update offer analytics in real-time
const updateOfferAnalytics = async (appliedOffers, restaurantId, req) => {
  try {
    console.log("Updating offer analytics for:", appliedOffers);

    const io = req.app.get("io");
    if (io) {
      appliedOffers.forEach((appliedOffer) => {
        // Emit analytics update to restaurant
        io.to(restaurantId.toString()).emit("campaignAnalyticsUpdate", {
          offerId: appliedOffer.offerId,
          offerType: appliedOffer.offerType,
          discountAmount: appliedOffer.discountAmount,
          message: "Campaign analytics updated",
          timestamp: new Date(),
        });

        // Also emit to admin channel for admin offers
        io.to("admin-channel").emit("adminOfferAnalyticsUpdate", {
          offerId: appliedOffer.offerId,
          offerType: appliedOffer.offerType,
          discountAmount: appliedOffer.discountAmount,
          restaurantId: restaurantId,
          message: "Admin offer analytics updated",
          timestamp: new Date(),
        });

        console.log(
          `Emitted analytics update for offer ${appliedOffer.offerId}`
        );
      });
    }
  } catch (error) {
    console.error("Error updating offer analytics:", error);
  }
};
