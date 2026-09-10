const express = require("express");
const {
  createAd,
  getAllAds,
  getAdsByPosition,
  getAdById,
  updateAd,
  deleteAd,
  toggleAdStatus,
} = require("../../controllers/marketplace/adController");

const router = express.Router();

// Public
router.get("/position/:position", getAdsByPosition);

// Admin
router.route("/")
  .post(createAd)
  .get(getAllAds);

router.route("/:id")
  .get(getAdById)
  .put(updateAd)
  .delete(deleteAd);

router.patch("/:id/toggle", toggleAdStatus);

module.exports = router;