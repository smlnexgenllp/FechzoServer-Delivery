// /routes/outlet/outletRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getOutletInfo, 
  updateOutletInfo, 
  requestTitleChange, 
  uploadImage, 
  upload 
} = require('../../../controllers/restaurants/outlet/Outletcontroller'); 

const { 
  getDocuments, 
  updateDocuments ,
  handleDocumentApproval
} = require('../../../controllers/restaurants/outlet/outletDocController');

const { 
  getBankDetails, 
  updateBankDetails, 
  handleBankDetailsApproval 
} = require('../../../controllers/restaurants/outlet/outletBankController');

router.get('/', (req, res) => {
  res.send("Outlet settings");
});


router.get('/documents', getDocuments);
router.post('/documents', upload.single('document'), updateDocuments);

// Add new route for document approval
router.put('/documents/approval', handleDocumentApproval);

// Add route for getting pending documents
router.get('/documents/pending', async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const restaurant = await Restaurant.findById(restaurantId);
    
    const pendingDocuments = {
      pan: restaurant.legalDetails.pendingPanDetails || null,
      fssai: restaurant.legalDetails.pendingFssaiDetails || null
    };

    res.json(pendingDocuments);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching pending documents',
      error: error.message 
    });
  }
});

router.get('/bank-details/:restaurantId', getBankDetails);
router.post('/bank-details', updateBankDetails);
router.put('/bank-details/approval', handleBankDetailsApproval);



module.exports = router;