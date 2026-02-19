const DeliveryPartner = require("../../models/deliverypartner/DeliveryPartner");

// Existing function (DON'T CHANGE)
const checkDeliveryPartner = async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await DeliveryPartner.findOne({ phone });

    res.json({
      exists: !!user,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ NEW: ADMIN – Get pending delivery partners
const getPendingPartners = async (req, res) => {
  try {
    const partners = await DeliveryPartner.find({
      approvalStatus: "PENDING",
      onboardingCompleted: true, // only show those who completed onboarding
    })
      .select(
        "fullName phone email vehicleType vehicleNumber licenseNumber aadharNumber " +
        "city area latitude longitude bankName accountNumber ifsc " +
        "profilePhoto panCard aadharFront drivingLicenseFront rcBookFront " +
        "onboardingCompleted approvalStatus isActive createdAt"
      )
      .sort({ createdAt: -1 }) // newest first
      .lean(); // faster, plain JS objects

    res.status(200).json({
      success: true,
      count: partners.length,
      partners,
    });
  } catch (err) {
    console.error("Get pending partners error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching pending partners",
    });
  }
};

// ✅ NEW: ADMIN – Approve delivery partner
const approvePartner = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const partner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      {
        approvalStatus: "APPROVED",
        isActive: true,
      },
      { new: true }
    );

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.status(200).json({
      success: true,
      message: "Partner approved successfully",
      partner,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ADMIN – Get approved partners
const getApprovedPartners = async (req, res) => {
  try {
    const partners = await DeliveryPartner.find({
      approvalStatus: "APPROVED",
    });

    res.status(200).json({
      success: true,
      partners,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const partner = await DeliveryPartner.findById(req.partner._id)
      .select(
        'fullName email phone profileImage rating totalRatings ' +
        'vehicleNumber vehicleType licenseNumber ' +
        'bankName accountNumber ifsc ' +                     // ← ADD THESE
        'isActive approvalStatus onboardingCompleted documentsSubmitted ' +
        'city area createdAt lastActive'
      )
      .lean();

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    const profile = {
      fullName: partner.fullName || '—',
      email: partner.email || '—',
      phone: partner.phone || '—',
      profileImage: partner.profileImage || null,
      rating: partner.rating ? Number(partner.rating).toFixed(1) : '0.0',
      totalRatings: partner.totalRatings || 0,
      vehicleNumber: partner.vehicleNumber || 'Not set',
      vehicleType: partner.vehicleType || 'Not set',
      licenseNumber: partner.licenseNumber || 'Not set',
      // Masked bank details (Zomato style)
      bankName: partner.bankName || '—',
      accountNumber: partner.accountNumber
        ? `••••••••${partner.accountNumber.slice(-4)}`   // shows ••••••••6766
        : 'Not linked',
      ifsc: partner.ifsc ? `••••${partner.ifsc.slice(-4)}` : '—',
      city: partner.city || '—',
      area: partner.area || '—',
      isActive: !!partner.isActive,
      approvalStatus: partner.approvalStatus || 'PENDING',
      onboardingCompleted: !!partner.onboardingCompleted,
      documentsSubmitted: !!partner.documentsSubmitted,
      joinedOn: partner.createdAt
        ? new Date(partner.createdAt).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '—',
    };

    res.status(200).json({
      success: true,
      profile,
    });
  } catch (err) {
    console.error('getMyProfile error:', err.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};
// UPDATE: Partner updates their own profile (PATCH /profile)
const updateMyProfile = async (req, res) => {
  try {
    // req.partner comes from verifyPartner middleware
    const partnerId = req.partner._id;

    console.log("[PATCH /profile] Partner ID:", partnerId);
    console.log("[PATCH /profile] Received updates:", req.body);

    if (!partnerId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated - missing partner ID",
      });
    }

    // Only allow these fields to be updated (security)
    const allowedFields = ["fullName", "email", "phone", "city", "area"];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    // Perform the update
    const updatedPartner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      { $set: updates },
      {
        new: true,           // return the updated document
        runValidators: true, // enforce schema rules
      }
    ).select("-password -otp -otpExpires -__v"); // exclude sensitive fields

    if (!updatedPartner) {
      return res.status(404).json({
        success: false,
        message: "Partner not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      partner: updatedPartner,
    });
  } catch (err) {
    console.error("updateMyProfile error:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.values(err.errors).map((e) => e.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating profile",
      error: err.message,
    });
  }
};
// 1. Install multer if not already
// npm install multer

// 2. In your routes file (deliveryPartnerRoutes.js)
const multer = require('multer');
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  }
});

// Single file upload middleware
const uploadSingle = upload.single('document');

// 3. In controller
const uploadDocument = async (req, res) => {
  uploadSingle(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific error (size limit, etc.)
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid file'
      });
    }

    try {
      console.log('Uploaded file:', req.file?.originalname);
      console.log('Document type:', req.body.documentType);

      const { documentType } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No document file provided'
        });
      }

      if (!['aadhaar', 'drivingLicense'].includes(documentType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document type'
        });
      }

      // TODO: Upload file to Cloudinary / AWS S3 / local folder
      // For testing: let's just pretend we have a URL
      const fileUrl = `http://localhost:5000/uploads/${file.filename}`; // replace with real upload

      // Update partner document status
      const updateField = `documents.${documentType}`;
      await DeliveryPartner.findByIdAndUpdate(req.partner._id, {
        [updateField]: {
          url: fileUrl,
          status: 'pending',
          uploadedAt: new Date(),
          rejectionReason: null
        }
      });

      res.json({
        success: true,
        message: 'Document uploaded successfully',
        url: fileUrl
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during upload'
      });
    }
  });
};
// GET /api/delivery-partner/documents
const getPartnerDocuments = async (req, res) => {
  try {
    const partner = await DeliveryPartner.findById(req.partner._id)
      .select('documents'); // assuming you have a documents object in schema

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }

    res.json({
      success: true,
      documents: partner.documents || {
        aadhaar: { status: 'pending', url: null, rejectionReason: null },
        drivingLicense: { status: 'pending', url: null, rejectionReason: null },
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
module.exports = {
  checkDeliveryPartner,
  getPendingPartners,
   approvePartner,
   getApprovedPartners, 
    updateMyProfile,
   getMyProfile,
   uploadDocument,
   getPartnerDocuments,
};
  