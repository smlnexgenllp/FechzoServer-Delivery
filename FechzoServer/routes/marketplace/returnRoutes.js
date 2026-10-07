const express = require("express");

const router = express.Router();

const {
  createReturnRequest,
  getUserReturnRequests,
  getReturnRequestById,
  cancelReturnRequest,
  getStoreReturnRequests,
  updateReturnStatus,
} = require("../../controllers/marketplace/returnController");

/* =====================================================
   USER
===================================================== */

// Create return
router.post(
  "/",
  createReturnRequest
);

// Get user's return requests
router.get(
  "/user/:userId",
  getUserReturnRequests
);

// Get single return request
router.get(
  "/:returnId",
  getReturnRequestById
);

// Cancel return
router.patch(
  "/:returnId/cancel",
  cancelReturnRequest
);

/* =====================================================
   STORE / ADMIN
===================================================== */

// Get store returns
router.get(
  "/store/:storeId",
  getStoreReturnRequests
);

// Update return status
router.patch(
  "/:returnId/status",
  updateReturnStatus
);

module.exports = router;