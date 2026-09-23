const MarketOrder = require("../../models/MarketPlace/MarketOrder"); // adjust path
const PDFDocument = require("pdfkit");
const moment = require("moment");

/* =====================================================
   HELPER: Get Store ID safely
===================================================== */
const getStoreId = (req) => {
  // 1. If protectStore middleware is used
  if (req.store?._id) return req.store._id;

  // 2. If storeId is sent in query (useful for testing)
  if (req.query.storeId) return req.query.storeId;

  // 3. If store info is in the token (req.user)
  if (req.user?.storeId) return req.user.storeId;
  if (req.user?.store?._id) return req.user.store._id;

  return null;
};

/* =====================================================
   HELPER: Build filter for store payments
===================================================== */
const buildPaymentFilter = (storeId, query) => {
  const filter = { store: storeId };

  // Search
  if (query.search) {
    const search = query.search.trim();
    filter.$or = [
      { orderId: { $regex: search, $options: "i" } },
      { paymentId: { $regex: search, $options: "i" } },
      { razorpayOrderId: { $regex: search, $options: "i" } },
      { "deliveryAddress.name": { $regex: search, $options: "i" } },
      { "deliveryAddress.phone": { $regex: search, $options: "i" } },
    ];
  }

  // Payment Status
  if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus;
  }

  // Payment Method
  if (query.paymentMethod) {
    filter.paymentMethod = query.paymentMethod;
  }

  // Date Range (on createdAt)
  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) {
      filter.createdAt.$gte = moment(query.fromDate).startOf("day").toDate();
    }
    if (query.toDate) {
      filter.createdAt.$lte = moment(query.toDate).endOf("day").toDate();
    }
  }

  return filter;
};

/* =====================================================
   1. GET PAYMENTS (List + Search + Filter)
===================================================== */
exports.getPayments = async (req, res) => {
  try {
    const storeId = getStoreId(req);

    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: "Store not authenticated / storeId missing",
      });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = buildPaymentFilter(storeId, req.query);

    const [payments, total] = await Promise.all([
      MarketOrder.find(filter)
        .select(
          "orderId user deliveryAddress items subtotal deliveryCharge discount tax totalAmount paymentMethod paymentStatus paymentId razorpayOrderId status createdAt"
        )
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MarketOrder.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getPayments error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch payments" });
  }
};

/* =====================================================
   2. PAYMENT SUMMARY (Dashboard cards)
===================================================== */
exports.getPaymentSummary = async (req, res) => {
  try {
    const storeId = getStoreId(req);

    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: "Store not authenticated / storeId missing",
      });
    }

    const filter = buildPaymentFilter(storeId, req.query);

    const summary = await MarketOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$totalAmount", 0],
            },
          },
          pendingAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Pending"] }, "$totalAmount", 0],
            },
          },
          refundedAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Refunded"] }, "$totalAmount", 0],
            },
          },
          failedAmount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "Failed"] }, "$totalAmount", 0],
            },
          },
          codCount: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "COD"] }, 1, 0] },
          },
          onlineCount: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "Online"] }, 1, 0] },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: summary[0] || {
        totalOrders: 0,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        refundedAmount: 0,
        failedAmount: 0,
        codCount: 0,
        onlineCount: 0,
      },
    });
  } catch (error) {
    console.error("getPaymentSummary error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch summary" });
  }
};

/* =====================================================
   3. DOWNLOAD PAYMENTS PDF
===================================================== */
exports.downloadPaymentsPDF = async (req, res) => {
  try {
    const storeId = getStoreId(req);

    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: "Store not authenticated / storeId missing",
      });
    }

    const filter = buildPaymentFilter(storeId, req.query);

    const payments = await MarketOrder.find(filter)
      .select(
        "orderId deliveryAddress totalAmount paymentMethod paymentStatus paymentId status createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    // Create PDF
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const filename = `payments_${moment().format("YYYYMMDD_HHmmss")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header
    doc.fontSize(18).text("Payment Report", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#555");
    doc.text(`Generated on: ${moment().format("DD MMM YYYY, hh:mm A")}`, {
      align: "center",
    });

    if (req.query.fromDate || req.query.toDate) {
      doc.text(
        `Period: ${req.query.fromDate || "Start"} → ${req.query.toDate || "End"}`,
        { align: "center" }
      );
    }
    doc.moveDown();

    // Table Header
    const startX = 40;
    let y = doc.y;

    doc.fontSize(9).fillColor("#000").font("Helvetica-Bold");
    doc.text("Order ID", startX, y, { width: 80 });
    doc.text("Customer", startX + 85, y, { width: 100 });
    doc.text("Amount", startX + 190, y, { width: 60 });
    doc.text("Method", startX + 255, y, { width: 50 });
    doc.text("Status", startX + 310, y, { width: 60 });
    doc.text("Date", startX + 375, y, { width: 90 });

    y += 18;
    doc.moveTo(startX, y).lineTo(555, y).stroke();
    y += 8;

    // Rows
    doc.font("Helvetica").fontSize(8);

    payments.forEach((p, index) => {
      if (y > 750) {
        doc.addPage();
        y = 40;
      }

      const customer = p.deliveryAddress?.name || "-";
      const amount = `₹${(p.totalAmount || 0).toFixed(2)}`;
      const date = moment(p.createdAt).format("DD MMM YY");

      doc.text(p.orderId || "-", startX, y, { width: 80 });
      doc.text(customer.substring(0, 18), startX + 85, y, { width: 100 });
      doc.text(amount, startX + 190, y, { width: 60 });
      doc.text(p.paymentMethod || "-", startX + 255, y, { width: 50 });
      doc.text(p.paymentStatus || "-", startX + 310, y, { width: 60 });
      doc.text(date, startX + 375, y, { width: 90 });

      y += 16;

      // light separator every 5 rows
      if ((index + 1) % 5 === 0) {
        doc
          .moveTo(startX, y - 2)
          .lineTo(555, y - 2)
          .strokeOpacity(0.2)
          .stroke();
        doc.strokeOpacity(1);
      }
    });

    // Footer summary
    doc.moveDown(2);
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text(`Total Records: ${payments.length}`, { align: "right" });

    doc.end();
  } catch (error) {
    console.error("downloadPaymentsPDF error:", error);
    res.status(500).json({ success: false, message: "Failed to generate PDF" });
  }
};

/* =====================================================
   4. UPDATE PAYMENT STATUS (optional - for COD collection)
===================================================== */
exports.updatePaymentStatus = async (req, res) => {
  try {
    const storeId = getStoreId(req);

    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: "Store not authenticated / storeId missing",
      });
    }

    const { orderId } = req.params;
    const { paymentStatus, adminNote } = req.body;

    const allowed = ["Pending", "Paid", "Failed", "Refunded"];
    if (!allowed.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    const order = await MarketOrder.findOne({ orderId, store: storeId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Only allow store to mark COD as Paid / Failed
    if (order.paymentMethod === "COD") {
      order.paymentStatus = paymentStatus;
      if (adminNote) order.adminNote = adminNote;
      await order.save();

      return res.status(200).json({
        success: true,
        message: "Payment status updated",
        data: {
          orderId: order.orderId,
          paymentStatus: order.paymentStatus,
        },
      });
    }

    // Online payments should normally be handled by webhook
    return res.status(400).json({
      success: false,
      message: "Online payment status cannot be changed manually",
    });
  } catch (error) {
    console.error("updatePaymentStatus error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment status",
    });
  }
};