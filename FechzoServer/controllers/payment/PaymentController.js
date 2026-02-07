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
    selectedOffer,
    offerBenefits,
  } = req.body;

  try {
    console.log("Starting order creation with body:", req.body);

    // Input validation
    console.log("Validating inputs");
    if (!amount || amount <= 0) {
      console.log("Invalid amount:", amount);
      return res.status(400).json({ error: "Invalid amount" });
    }
    if (
      !paymentMethod ||
      !["cash", "cards", "upi", "wallets"].includes(paymentMethod)
    ) {
      console.log("Invalid payment method:", paymentMethod);
      return res.status(400).json({ error: "Invalid payment method" });
    }
    if (!userId) {
      console.log("User ID missing");
      return res.status(400).json({ error: "User ID is required" });
    }
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      console.log("Invalid cart items:", cartItems);
      return res.status(400).json({ error: "Cart items are required" });
    }
    if (
      !selectedAddress ||
      !selectedAddress.address ||
      !selectedAddress.phone
    ) {
      console.log("Invalid address:", selectedAddress);
      return res.status(400).json({ error: "Valid address is required" });
    }
    if (
      paymentMethod === "upi" &&
      (!upiId || !upiId.match(/^[\w.-]+@[\w.-]+$/))
    ) {
      console.log("Invalid UPI ID:", upiId);
      return res
        .status(400)
        .json({ error: "Valid UPI ID is required for UPI payments" });
    }
    if (!itemsTotal || isNaN(parseFloat(itemsTotal))) {
      console.log("Invalid items total:", itemsTotal);
      return res.status(400).json({ error: "Valid items total is required" });
    }
    if (!deliveryCharge || isNaN(parseFloat(deliveryCharge))) {
      console.log("Invalid delivery charge:", deliveryCharge);
      return res
        .status(400)
        .json({ error: "Valid delivery charge is required" });
    }
    if (!packingCharge || isNaN(parseFloat(packingCharge))) {
      console.log("Invalid packing charge:", packingCharge);
      return res
        .status(400)
        .json({ error: "Valid packing charge is required" });
    }
    if (!platformFee || isNaN(parseFloat(platformFee))) {
      console.log("Invalid platform fee:", platformFee);
      return res.status(400).json({ error: "Valid platform fee is required" });
    }
    if (!cgst || isNaN(parseFloat(cgst))) {
      console.log("Invalid CGST:", cgst);
      return res.status(400).json({ error: "Valid CGST is required" });
    }
    if (!sgst || isNaN(parseFloat(sgst))) {
      console.log("Invalid SGST:", sgst);
      return res.status(400).json({ error: "Valid SGST is required" });
    }
    if (discount && isNaN(parseFloat(discount))) {
      console.log("Invalid discount:", discount);
      return res.status(400).json({ error: "Valid discount is required" });
    }
    if (paymentMethod === "cash" && amount < 100) {
      console.log("Cash on delivery not available for amount:", amount);
      return res.status(400).json({
        error: "Cash on delivery not available for orders below ₹100",
      });
    }

    // Calculate grand total
    console.log("Calculating grand total");
    const calculatedGrandTotal = (
      parseFloat(itemsTotal) -
      parseFloat(discount || "0.00") +
      parseFloat(deliveryCharge) +
      parseFloat(packingCharge) +
      parseFloat(platformFee) +
      parseFloat(cgst) +
      parseFloat(sgst)
    ).toFixed(2);
    console.log("Calculated grand total:", calculatedGrandTotal);

    // Validate amount matches grand total
    if (parseFloat(amount).toFixed(2) !== calculatedGrandTotal) {
      console.log(
        "Amount mismatch. Expected:",
        calculatedGrandTotal,
        "Received:",
        amount
      );
      return res.status(400).json({
        error: "Provided amount does not match calculated grand total",
        details: `Expected: ${calculatedGrandTotal}, Received: ${amount}`,
      });
    }

    // Fetch the user's cart to get restaurant info
    console.log("Fetching cart for user:", userId);
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      console.log("Cart not found for user:", userId);
      return res.status(404).json({ error: "Cart not found" });
    }
    console.log("Cart fetched:", cart);

    // Get restaurant details
    console.log("Fetching restaurant:", cart.restaurant_id);
    const restaurant = await mongoose
      .model("Restaurant")
      .findById(cart.restaurant_id);
    if (!restaurant) {
      console.log("Restaurant not found:", cart.restaurant_id);
      return res.status(404).json({ error: "Restaurant not found" });
    }
    console.log("Restaurant fetched:", restaurant.restaurantName);

    // Construct orderSummary array
    console.log("Constructing order summary");
    const orderSummary = [];
    cartItems.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      const addonTotal = item.addons
        ? item.addons.reduce(
            (sum, addon) => sum + (addon.price || 0) * (addon.quantity || 0),
            0
          )
        : 0;
      orderSummary.push({
        type: "item",
        id: item.id,
        totalCost: (itemTotal + addonTotal).toFixed(2),
      });
    });
    orderSummary.push({ type: "itemsTotal", value: itemsTotal });
    // Only add discount entry if there's actually a discount and promo code
    if (discount && parseFloat(discount) > 0) {
      const discountEntry = {
        type: "discount",
        value: discount,
      };

      // Only add promoCode if it's not empty
      if (appliedPromoCode && appliedPromoCode.trim() !== "") {
        discountEntry.promoCode = appliedPromoCode;
      }

      orderSummary.push(discountEntry);
    }
    orderSummary.push({ type: "deliveryCharge", value: deliveryCharge });
    orderSummary.push({ type: "packingCharge", value: packingCharge });
    orderSummary.push({ type: "platformFee", value: platformFee });
    orderSummary.push({ type: "cgst", value: cgst });
    orderSummary.push({ type: "sgst", value: sgst });
    orderSummary.push({ type: "grandTotal", value: calculatedGrandTotal });
    console.log("Order summary constructed:", orderSummary);

    // Generate orderId and paymentId
    const orderId = await generateOrderId();
    const paymentId = await generatePaymentId();

    // ADD THIS ENTIRE SECTION - NEW: Track applied offers
    console.log("Processing applied offers");
    const appliedOffers = [];

    // Handle promo code offers
    if (appliedPromoCode) {
      // Find the promo offer
      let promoOffer = null;

      // Check restaurant-specific offers first
      promoOffer = await Offer.findOne({
        restaurantId: cart.restaurant_id,
        offerType: 'promo',
        promoCode: appliedPromoCode,
        status: 'Active',
        validFrom: { $lte: new Date() },
        validTo: { $gte: new Date() }
      });

      // If not found, check admin offers
      if (!promoOffer) {
        promoOffer = await AdminOffer.findOne({
          offerType: 'promo',
          promoCode: appliedPromoCode,
          status: 'Active',
          validFrom: { $lte: new Date() },
          validTo: { $gte: new Date() }
        });
      }

      if (promoOffer) {
        appliedOffers.push({
          offerId: promoOffer._id,
          offerType: 'promo',
          promoCode: appliedPromoCode,
          discountAmount: parseFloat(discount || 0),
          freeItems: [],
          appliedAt: new Date()
        });
      }
    }

    // Handle selected offer (freebie, bogo, combo)
    if (selectedOffer && selectedOffer.type !== 'promo') {
      // Extract the actual ObjectId from the prefixed string
      let actualOfferId = selectedOffer.id;
      if (typeof actualOfferId === 'string' && actualOfferId.includes('-')) {
        // Remove prefix like "freebie-", "bogo-", "combo-"
        actualOfferId = actualOfferId.split('-')[1];
      }

      console.log('Processing selected offer:', selectedOffer.type, 'with ID:', actualOfferId);

      const offer = await Offer.findById(actualOfferId);
      if (offer) {
        const appliedOffer = {
          offerId: offer._id,
          offerType: selectedOffer.type,
          discountAmount: 0,
          appliedAt: new Date()
        };

        if (selectedOffer.type === 'freebie') {
          appliedOffer.freeItems = [selectedOffer.item?.name || 'Free Item'];
          // Set the discount amount to the item's value for display purposes
          appliedOffer.discountAmount = parseFloat(selectedOffer.value || selectedOffer.item?.price || 0);
        } else if (selectedOffer.type === 'bogo') {
          appliedOffer.freeItems = [selectedOffer.getFreeItem || 'Free Item'];
          // Add discount amount calculation for BOGO
          appliedOffer.discountAmount = parseFloat(selectedOffer.value || selectedOffer.discountValue || 0);
        } else if (selectedOffer.type === 'combo') {
          appliedOffer.discountAmount = parseFloat(discount || 0);
        }

        appliedOffers.push(appliedOffer);
        console.log('Applied offer added:', appliedOffer);
      } else {
        console.log('Offer not found with ID:', actualOfferId);
      }
    }

    // Create Order document
    console.log("Creating order document");
    const orderData = {
      orderId,
      userId,
      cartItems,
      total: amount,
      selectedAddress,
      restaurantId: cart.restaurant_id,
      restaurantName: restaurant.restaurantName || 'Restaurant',
      restaurantImage: restaurant.images?.profile || '',
    };
    console.log("Order data:", orderData);

    const session = await mongoose.startSession();
    console.log("Mongoose session started");
    session.startTransaction();
    try {
      const order = new Order(orderData);
      console.log("Saving order:", orderId);
      await order.save({ session });
      console.log("Order saved:", orderId);

      if (appliedOffers.length > 0) {
        await updateOfferAnalytics(appliedOffers, cart.restaurant_id, req);
      }

      // Create Payment document with orderSummary
      const paymentData = {
        paymentId,
        orderId,
        paymentMethod,
        paymentStatus: "pending",
        upiId: paymentMethod === "upi" ? upiId : undefined,
        orderSummary,
        appliedOffers: appliedOffers,
      };
      console.log("Payment data:", paymentData);

      let razorpayOrder = null;
      if (paymentMethod !== "cash") {
        const options = {
          amount: Math.round(parseFloat(amount) * 100), // Convert to paise and ensure integer
          currency: "INR",
          receipt: `receipt_order_${Date.now()}`,
        };
        console.log("Creating Razorpay order with options:", options);
        try {
          razorpayOrder = await razorpayInstance.orders.create(options);
          console.log("Razorpay order created:", razorpayOrder);
          paymentData.razorpayOrderId = razorpayOrder.id;
        } catch (razorpayErr) {
          console.error("Razorpay order creation failed:", razorpayErr);
          throw new Error(
            `Razorpay order creation failed: ${
              razorpayErr.message || "Unknown error"
            }`
          );
        }
      }

      const payment = new Payment(paymentData);
      console.log("Saving payment:", paymentId);
      await payment.save({ session });
      console.log("Payment saved:", paymentId);

      console.log("Committing transaction");
      await session.commitTransaction();
      console.log("Transaction committed");

      if (paymentMethod === "cash") {
        console.log("Deleting cart for user:", userId);
        await Cart.deleteOne({ userId });
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
              paymentMethod: paymentMethod,
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
          console.log(
            "Notification emitted to restaurant:",
            order.restaurantId
          );
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

        console.log("Order placed successfully for order:", orderId);
        return res.json({
          success: true,
          orderId,
          paymentId,
          message: "Order placed successfully",
        });
      }

      console.log("Returning Razorpay order response:", razorpayOrder);
      res.json({ ...razorpayOrder, orderId, paymentId });
    } catch (err) {
      console.error("Transaction error:", err);
      await session.abortTransaction();
      console.log("Transaction aborted");
      throw err;
    } finally {
      console.log("Ending Mongoose session");
      session.endSession();
    }
  } catch (err) {
    console.error("Error creating order:", err.stack);
    res
      .status(500)
      .json({
        error: "Failed to create order",
        details: err.message || "Unknown error",
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
