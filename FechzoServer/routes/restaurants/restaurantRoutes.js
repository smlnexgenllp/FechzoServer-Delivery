const express = require('express');
const router = express.Router();
const multer = require('multer');
const OfferRoutes = require("./offers/OfferRoutes");
const PerformanceRoutes = require("./offers/performanceRoutes");
const BranchRoutes = require("./offers/branchRoutes");
const FoodRoutes = require("./food/FoodRoutes");
const FoodMenuRoutes = require("./foodmenu/FoodMenuRoutes");
const FoodReviews = require("./reviews/reviewsroutes");
const FoodInventory = require("./restaurantdashboard/Dashboardroutes");
const orderController = require('../../controllers/restaurantportal/orderHistory/OrderHistory');
// const ActionLog = require("../../models/restaurants/actionlogs");
const { getRestaurantActionLogs, createActionLog, validateActionLog, updateActionLogStatus } = require('../../controllers/restaurants/Actionlogcontroller/ActionlogController');
const {
  getRestaurantSocialMedia,
  addSocialMediaPlatform,
  removeSocialMediaPlatform
} = require('../../controllers/restaurants/outlet/SocialMediaController');


// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory for processing
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const profileImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// Configure fields for branch uploads
const branchUpload = upload.fields([
  { name: 'profileImage', maxCount: 1 }, // Changed from restaurantImage
  { name: 'foodImages', maxCount: 10 },
  { name: 'menuImages', maxCount: 10 },
  { name: 'uploadFssaiLicense', maxCount: 1 }
]);

const {
  getRestaurantContacts,
  updateOwnerDetails,
  updateManagerDetails,
  sendInvite,
  acceptInvite
} = require('../../controllers/restaurants/outlet/ContactController');

const {
  getRestaurantAbout,
  updateRestaurantAbout,
  uploadProfileImage,
  requestTitleChange,
  handleAboutApproval,
} = require("../../controllers/restaurants/outlet/AboutController");

const {
  addBranch,
  getBranches,
  getBranchDetails,
  updateBranch,
  deleteBranch
} = require('../../controllers/shops/BranchController');

const {
  getRestaurantImages,
  uploadRestaurantImages,
  deleteRestaurantImage,
  approveRestaurantImage,
  imageUpload
} = require('../../controllers/restaurants/outlet/ImageController');

const {
  getRestaurantAddress,
  updateRestaurantAddress
} = require('../../controllers/restaurants/outlet/AddressController');

const { getIsOpenNow } = require('../../controllers/restaurants/outlet/TimingsController');

const { getGlobalStatus, setGlobalStatus } = require('../../controllers/restaurants/outlet/TimingsController');

const {
  getRestaurantTimings,
  updateRestaurantTimings
} = require('../../controllers/restaurants/outlet/TimingsController');

const {
  getRestaurantNumbers,
  updateRestaurantNumbers
} = require('../../controllers/restaurants/outlet/NumbersController');

const {
  getRestaurantAccountManager,
  updateRestaurantAccountManager
} = require('../../controllers/restaurants/outlet/ManagersController');
const {getBranchDetail} =require('../../controllers/restaurantportal/branch/GetBranch');

const { configureFileUpload, handleFileUpload } = require('../../middleware/shops/RestaurantDetails');

const { getMenuDashboardInfo } = require('../../controllers/restaurantportal/dashboard/MenuDashboardController');

const { getRestaurantById } = require('../../controllers/shops/RestaurantDetails');

const {
  getRestaurantLogs,
  createRestaurantLog,
  logTimingChange,
  logServiceStatusChange,
  logGlobalStatusChange
} = require('../../controllers/restaurants/Logcontroller/RestaurantLogsController');

const { getOperatingHours } = require('../../controllers/restaurants/Logcontroller/OperatingHoursController');

router.use('/offers', OfferRoutes);
router.use('/performance', PerformanceRoutes);
router.use('/branches', BranchRoutes);
router.use('/foodpage', FoodRoutes);
router.use('/category', FoodMenuRoutes);
router.use('/reviews', FoodReviews);
router.use('/inventory', FoodInventory);

// Restaurant Logs Routes
router.get('/:restaurantId/logs', getRestaurantLogs);
router.post('/:restaurantId/logs', createRestaurantLog);
router.post('/:restaurantId/logs/timing', logTimingChange);
router.post('/:restaurantId/logs/service', logServiceStatusChange);
router.post('/:restaurantId/logs/status', logGlobalStatusChange);

router.get('/:restaurantId/operating-hours', getOperatingHours);

// Route to fetch restaurant details by ID
router.get('/:restaurantId', getRestaurantById);

// Action Log Routes
router.get('/controls/:restaurantId', getRestaurantActionLogs);
router.post('/controls', validateActionLog, createActionLog);
router.put('/controls/status', updateActionLogStatus);


router.get('/:restaurantId/is-open-now', getIsOpenNow);

router.get('/:restaurantId/global-status', getGlobalStatus);
router.put('/:restaurantId/global-status', setGlobalStatus);

// Timings route
router.get('/:restaurantId/timings', getRestaurantTimings);
router.put('/:restaurantId/timings', updateRestaurantTimings);

router.get('/:restaurantId/address', getRestaurantAddress);
router.put('/:restaurantId/address', updateRestaurantAddress);

// Numbers routes
router.get('/:restaurantId/numbers', getRestaurantNumbers);
router.put('/:restaurantId/numbers', updateRestaurantNumbers);

// Account Manager routes
router.get('/:restaurantId/accountManager', getRestaurantAccountManager);
router.put('/:restaurantId/accountManager', updateRestaurantAccountManager);

// Restaurant contact routes
router.get('/:id/contacts', getRestaurantContacts);
router.put('/:id/owner', updateOwnerDetails);
router.put('/:id/manager', updateManagerDetails);
router.post('/:id/invite', sendInvite);
router.get('/:id/accept-invite', acceptInvite);

// About routes
router.get("/:id/about", getRestaurantAbout);
router.put("/:id/about", updateRestaurantAbout);
router.post("/:id/upload-profile-image", profileImageUpload.single("image"), uploadProfileImage);
router.post("/:id/title-request", requestTitleChange);
router.put("/about/approval", handleAboutApproval);

// Branch management routes
router.post('/:restaurantId/branches', branchUpload, addBranch);
router.get('/:restaurantId/branches', getBranches);
router.get('/branches/:branchId', getBranchDetails);
router.put('/branches/:branchId', branchUpload, updateBranch);
router.delete('/branches/:branchId', deleteBranch);

// Images routes
router.get('/:id/images', getRestaurantImages);
router.post('/:id/images', imageUpload, uploadRestaurantImages);
router.delete('/:id/images', deleteRestaurantImage);
// router.post('/:id/images/approve', approveRestaurantImage);

// Dashboard info
router.get('/:id/dashboard-info', getMenuDashboardInfo);

// Social Media routes
router.get('/:restaurantId/social-media', getRestaurantSocialMedia);
router.post('/:restaurantId/social-media', addSocialMediaPlatform);
router.delete('/:restaurantId/social-media', removeSocialMediaPlatform);

router.get('/restaurantorder/:restaurantId', orderController.getOrdersByRestaurant);

router.post('/branches/details',getBranchDetail);

module.exports = router;
