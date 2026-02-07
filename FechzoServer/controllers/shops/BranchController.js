// const mongoose = require('mongoose');
// const Restaurant = require('../../models/restaurants/shops/RestaurantDetails');
// const Branch = require('../../models/restaurants/shops/BranchDetails');
// const cloudinary = require('../../config/cloudinary');

// // Helper function to upload files to Cloudinary
// const uploadToCloudinary = async (file, folder) => {
//   return new Promise((resolve, reject) => {
//     const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
//       if (error) return reject(error);
//       resolve(result.secure_url);
//     });

//     uploadStream.end(file.buffer);
//   });
// };

// // Add a new branch to an existing restaurant
// const addBranch = async (req, res) => {
//   try {
//     const { restaurantId } = req.params;

//     // Parse branch data from form data
//     let branchData;
//     try {
//       branchData = JSON.parse(req.body.branchData);
//     } catch (error) {
//       return res.status(400).json({ message: "Invalid branch data format" });
//     }

//     // Try to find by restaurantId field first (which is a string)
//     let restaurant = await Restaurant.findOne({ restaurantId });

//     // If not found, try to find by _id (MongoDB ObjectId)
//     if (!restaurant && mongoose.Types.ObjectId.isValid(restaurantId)) {
//       restaurant = await Restaurant.findById(restaurantId);
//     }

//     if (!restaurant) {
//       console.log(`Restaurant not found with ID: ${restaurantId}`);
//       return res.status(404).json({ message: "Restaurant not found" });
//     }

//     // Generate a unique branch ID
//     const branchId = `${restaurant.restaurantId || restaurantId}-BR-${Date.now()}`;

//     // Process uploaded images
//     const uploadedImages = {
//       food: [],
//       menu: [],
//       profile: null,
//       restaurant: null,
//     };

//     // Upload restaurant image
//     if (req.files?.restaurantImage) {
//       uploadedImages.restaurant = await uploadToCloudinary(
//         req.files.restaurantImage[0],
//         "branch_restaurant_images"
//       );
//     }

//     // Upload profile image
//     if (req.files?.profileImage) {
//       uploadedImages.profile = await uploadToCloudinary(
//         req.files.profileImage[0],
//         "branch_profile_images"
//       );
//     }

//     // Upload food images
//     if (req.files?.foodImages?.length) {
//       for (const file of req.files.foodImages) {
//         const url = await uploadToCloudinary(file, "branch_food_images");
//         uploadedImages.food.push(url);
//       }
//     }

//     // Upload menu images
//     if (req.files?.menuImages?.length) {
//       for (const file of req.files.menuImages) {
//         const url = await uploadToCloudinary(file, "branch_menu_images");
//         uploadedImages.menu.push(url);
//       }
//     }

//     // Upload FSSAI license
//     let uploadFssaiLicenseUrl = null;
//     if (req.files?.uploadFssaiLicense) {
//       uploadFssaiLicenseUrl = await uploadToCloudinary(
//         req.files.uploadFssaiLicense[0],
//         "branch_fssai_licenses"
//       );
//     }

//     // Create new branch object
//     const newBranch = {
//       branchId,
//       branchName: branchData.branchName,
//       restaurantAddress: branchData.restaurantAddress,
//       images: uploadedImages,
//       timings: branchData.timings || {
//         delivery: { openTime: "", closeTime: "", days: [] },
//         dineIn: { openTime: "", closeTime: "", days: [] }
//       },
//       legalDetails: {
//         fssaiNumber: branchData.legalDetails?.fssaiNumber || "",
//         fssaiExpiryDate: branchData.legalDetails?.fssaiExpiryDate || "",
//         uploadFssaiLicense: uploadFssaiLicenseUrl,
//         gstNumber: branchData.legalDetails?.gstNumber || ""
//       },
//       managerDetails: branchData.managerDetails || {
//         managerName: "",
//         managerEmail: "",
//         managerPhone: "",
//         managerAltPhone: ""
//       },
//       approvalStatus: "Pending"
//     };

//     // Initialize branches array if it doesn't exist
//     if (!restaurant.branches) {
//       restaurant.branches = [];
//     }

//     // Add branch to restaurant
//     restaurant.branches.push(newBranch);
//     await restaurant.save();

//     res.status(201).json({
//       message: "Branch added successfully",
//       branch: newBranch
//     });

//   } catch (error) {
//     console.error("Error adding branch:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

// // Get all branches of a restaurant
// // Update the getBranches function to handle different ID formats
// const getBranches = async (req, res) => {
//   try {
//     const { restaurantId } = req.params;

//     // console.log("Received restaurant ID:", restaurantId);

//     // Try to find by restaurantId field first (which is a string)
//     let restaurant = await Restaurant.findOne({ restaurantId });

//     // If not found, try to find by _id (MongoDB ObjectId)
//     if (!restaurant && mongoose.Types.ObjectId.isValid(restaurantId)) {
//       restaurant = await Restaurant.findById(restaurantId);
//     }

//     if (!restaurant) {
//       console.log(`Restaurant not found with ID: ${restaurantId}`);
//       return res.status(404).json({ message: "Restaurant not found" });
//     }

//     // console.log(`Found restaurant: ${restaurant.restaurantName}`);
//     res.status(200).json({ branches: restaurant.branches || [] });

//   } catch (error) {
//     console.error("Error fetching branches:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

// // Get details of a specific branch
// const getBranchDetails = async (req, res) => {
//   try {
//     const { restaurantId, branchId } = req.params;

//     const restaurant = await Restaurant.findOne({ restaurantId });
//     if (!restaurant) {
//       return res.status(404).json({ message: "Restaurant not found" });
//     }

//     const branch = restaurant.branches.find(b => b.branchId === branchId);
//     if (!branch) {
//       return res.status(404).json({ message: "Branch not found" });
//     }

//     res.status(200).json({ branch });

//   } catch (error) {
//     console.error("Error fetching branch details:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

// // Update the updateBranch function to handle file uploads
// const updateBranch = async (req, res) => {
//   try {
//     const { restaurantId, branchId } = req.params;

//     // Parse branch data from form data
//     let updateData;
//     try {
//       updateData = JSON.parse(req.body.branchData);
//     } catch (error) {
//       return res.status(400).json({ message: "Invalid branch data format" });
//     }

//     // Try to find by restaurantId field first (which is a string)
//     let restaurant = await Restaurant.findOne({ restaurantId });

//     // If not found, try to find by _id (MongoDB ObjectId)
//     if (!restaurant && mongoose.Types.ObjectId.isValid(restaurantId)) {
//       restaurant = await Restaurant.findById(restaurantId);
//     }

//     if (!restaurant) {
//       console.log(`Restaurant not found with ID: ${restaurantId}`);
//       return res.status(404).json({ message: "Restaurant not found" });
//     }

//     const branchIndex = restaurant.branches.findIndex(b => b.branchId === branchId);
//     if (branchIndex === -1) {
//       return res.status(404).json({ message: "Branch not found" });
//     }

//     // Get existing branch for reference
//     const existingBranch = restaurant.branches[branchIndex];

//     // Check if the branch was rejected previously or if meaningful data was changed
//     const wasRejected = existingBranch.approvalStatus === "Rejected";
//     const shouldResetStatus = wasRejected ||
//       (updateData.branchName !== existingBranch.branchName) ||
//       (updateData.restaurantAddress && JSON.stringify(updateData.restaurantAddress) !== JSON.stringify(existingBranch.restaurantAddress)) ||
//       (updateData.legalDetails && JSON.stringify(updateData.legalDetails) !== JSON.stringify(existingBranch.legalDetails));

//     // Set approval status to "Pending" if branch was rejected or meaningful data was changed
//     if (shouldResetStatus) {
//       updateData.approvalStatus = "Pending";
//       // Clear rejection reason if it exists
//       updateData.rejectionReason = "";
//     }

//     // Process uploaded images
//     if (req.files) {
//       // Initialize images object if it doesn't exist
//       if (!updateData.images) {
//         updateData.images = { ...existingBranch.images };
//       }

//       // Upload restaurant image
//       if (req.files.restaurantImage) {
//         updateData.images.restaurant = await uploadToCloudinary(
//           req.files.restaurantImage[0],
//           "branch_restaurant_images"
//         );
//       }

//       // Upload profile image
//       if (req.files.profileImage) {
//         updateData.images.profile = await uploadToCloudinary(
//           req.files.profileImage[0],
//           "branch_profile_images"
//         );
//       }

//       // Upload food images
//       if (req.files.foodImages?.length) {
//         updateData.images.food = [];
//         for (const file of req.files.foodImages) {
//           const url = await uploadToCloudinary(file, "branch_food_images");
//           updateData.images.food.push(url);
//         }
//       }

//       // Upload menu images
//       if (req.files.menuImages?.length) {
//         updateData.images.menu = [];
//         for (const file of req.files.menuImages) {
//           const url = await uploadToCloudinary(file, "branch_menu_images");
//           updateData.images.menu.push(url);
//         }
//       }

//       // Upload FSSAI license
//       if (req.files.uploadFssaiLicense) {
//         if (!updateData.legalDetails) {
//           updateData.legalDetails = { ...existingBranch.legalDetails };
//         }
//         updateData.legalDetails.uploadFssaiLicense = await uploadToCloudinary(
//           req.files.uploadFssaiLicense[0],
//           "branch_fssai_licenses"
//         );
//       }
//     }

//     // Update branch fields
//     Object.keys(updateData).forEach(key => {
//       if (key !== 'branchId') { // Don't allow changing branchId
//         restaurant.branches[branchIndex][key] = updateData[key];
//       }
//     });

//     await restaurant.save();

//     res.status(200).json({
//       message: "Branch updated successfully",
//       branch: restaurant.branches[branchIndex]
//     });

//   } catch (error) {
//     console.error("Error updating branch:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

// // Delete a branch
// const deleteBranch = async (req, res) => {
//   try {
//     const { restaurantId, branchId } = req.params;

//     // console.log("Received restaurant ID for deleting branch:", restaurantId);

//     // Try to find by restaurantId field first (which is a string)
//     let restaurant = await Restaurant.findOne({ restaurantId });

//     // If not found, try to find by _id (MongoDB ObjectId)
//     if (!restaurant && mongoose.Types.ObjectId.isValid(restaurantId)) {
//       restaurant = await Restaurant.findById(restaurantId);
//     }

//     if (!restaurant) {
//       console.log(`Restaurant not found with ID: ${restaurantId}`);
//       return res.status(404).json({ message: "Restaurant not found" });
//     }

//     const branchIndex = restaurant.branches.findIndex(b => b.branchId === branchId);
//     if (branchIndex === -1) {
//       return res.status(404).json({ message: "Branch not found" });
//     }

//     // Remove branch
//     restaurant.branches.splice(branchIndex, 1);
//     await restaurant.save();

//     res.status(200).json({ message: "Branch deleted successfully" });

//   } catch (error) {
//     console.error("Error deleting branch:", error);
//     res.status(500).json({ message: "Internal server error", error: error.message });
//   }
// };

// module.exports = {
//   addBranch,
//   getBranches,
//   getBranchDetails,
//   updateBranch,
//   deleteBranch
// };

const mongoose = require('mongoose');
const Restaurant = require('../../models/restaurants/shops/RestaurantDetails');
const Branch = require('../../models/restaurants/shops/BranchDetails');
const cloudinary = require('../../config/cloudinary');

// Helper function to upload files to Cloudinary
const uploadToCloudinary = async (file, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    });

    uploadStream.end(file.buffer);
  });
};

// Add a new branch as a separate document
const addBranch = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Parse branch data from form data
    let branchData;
    try {
      branchData = JSON.parse(req.body.branchData);
    } catch (error) {
      return res.status(400).json({ message: "Invalid branch data format" });
    }

    // Try to find by restaurantId field first (which is a string)
    let restaurant = await Restaurant.findOne({ restaurantId });

    // If not found, try to find by _id (MongoDB ObjectId)
    if (!restaurant && mongoose.Types.ObjectId.isValid(restaurantId)) {
      restaurant = await Restaurant.findById(restaurantId);
    }

    if (!restaurant) {
      console.log(`Restaurant not found with ID: ${restaurantId}`);
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Generate a unique branch ID
    const branchId = `${restaurant.restaurantId || restaurantId}-BR-${Date.now()}`;

    // Process uploaded images
    const uploadedImages = {
      food: [],
      menu: [],
      profile: null,
      restaurant: null,
    };

    // Upload restaurant image
    if (req.files?.restaurantImage) {
      uploadedImages.restaurant = await uploadToCloudinary(
        req.files.restaurantImage[0],
        "branch_restaurant_images"
      );
    }

    // Upload profile image
    if (req.files?.profileImage) {
      uploadedImages.profile = await uploadToCloudinary(
        req.files.profileImage[0],
        "branch_profile_images"
      );
    }

    // Upload food images
    if (req.files?.foodImages?.length) {
      for (const file of req.files.foodImages) {
        const url = await uploadToCloudinary(file, "branch_food_images");
        uploadedImages.food.push(url);
      }
    }

    // Upload menu images
    if (req.files?.menuImages?.length) {
      for (const file of req.files.menuImages) {
        const url = await uploadToCloudinary(file, "branch_menu_images");
        uploadedImages.menu.push(url);
      }
    }

    // Upload FSSAI license
    let uploadFssaiLicenseUrl = null;
    if (req.files?.uploadFssaiLicense) {
      uploadFssaiLicenseUrl = await uploadToCloudinary(
        req.files.uploadFssaiLicense[0],
        "branch_fssai_licenses"
      );
    }

    // Create new branch as separate document
    const newBranch = new Branch({
      branchId,
      restaurantId: restaurant.restaurantId || restaurantId,
      brandName: restaurant.restaurantName, // Use restaurant name as brand name
      branchName: branchData.branchName,
      restaurantAddress: branchData.restaurantAddress,
      images: uploadedImages,
      timings: branchData.timings || {
        delivery: { openTime: "", closeTime: "", days: [] },
        dineIn: { openTime: "", closeTime: "", days: [] }
      },
      legalDetails: {
        fssaiNumber: branchData.legalDetails?.fssaiNumber || "",
        fssaiExpiryDate: branchData.legalDetails?.fssaiExpiryDate || "",
        uploadFssaiLicense: uploadFssaiLicenseUrl,
        gstNumber: branchData.legalDetails?.gstNumber || ""
      },
      managerDetails: branchData.managerDetails || {
        managerName: "",
        managerEmail: "",
        managerPhone: "",
        managerAltPhone: ""
      },
      approvalStatus: "Pending"
    });

    // Save branch as a separate document
    await newBranch.save();

    res.status(201).json({
      message: "Branch added successfully",
      branch: newBranch
    });

  } catch (error) {
    console.error("Error adding branch:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Get all branches of a restaurant
const getBranches = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Verify restaurant exists
    let restaurant = await Restaurant.findOne({ restaurantId });
    if (!restaurant && mongoose.Types.ObjectId.isValid(restaurantId)) {
      restaurant = await Restaurant.findById(restaurantId);
    }

    if (!restaurant) {
      console.log(`Restaurant not found with ID: ${restaurantId}`);
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Find all branches for this restaurant
    const branches = await Branch.find({
      restaurantId: restaurant.restaurantId || restaurantId
    });

    res.status(200).json({ branches });

  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Get details of a specific branch
const getBranchDetails = async (req, res) => {
  try {
    const { branchId } = req.params;

    const branch = await Branch.findOne({ branchId });
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    res.status(200).json({ branch });

  } catch (error) {
    console.error("Error fetching branch details:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Update a branch
const updateBranch = async (req, res) => {
  try {
    const { branchId } = req.params;

    // Parse branch data from form data
    let updateData;
    try {
      updateData = JSON.parse(req.body.branchData);
    } catch (error) {
      return res.status(400).json({ message: "Invalid branch data format" });
    }

    const existingBranch = await Branch.findOne({ branchId });
    if (!existingBranch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    // Check if the branch was rejected previously or if meaningful data was changed
    const wasRejected = existingBranch.approvalStatus === "Rejected";
    const shouldResetStatus = wasRejected ||
      (updateData.branchName !== existingBranch.branchName) ||
      (updateData.restaurantAddress && JSON.stringify(updateData.restaurantAddress) !== JSON.stringify(existingBranch.restaurantAddress)) ||
      (updateData.legalDetails && JSON.stringify(updateData.legalDetails) !== JSON.stringify(existingBranch.legalDetails));

    // Set approval status to "Pending" if branch was rejected or meaningful data was changed
    if (shouldResetStatus) {
      updateData.approvalStatus = "Pending";
      // Clear rejection reason if it exists
      updateData.rejectionReason = "";
    }

    // Process uploaded images
    if (req.files) {
      // Initialize images object if it doesn't exist
      if (!updateData.images) {
        updateData.images = { ...existingBranch.images };
      }

      // Upload restaurant image
      if (req.files.restaurantImage) {
        updateData.images.restaurant = await uploadToCloudinary(
          req.files.restaurantImage[0],
          "branch_restaurant_images"
        );
      }

      // Upload profile image
      if (req.files.profileImage) {
        updateData.images.profile = await uploadToCloudinary(
          req.files.profileImage[0],
          "branch_profile_images"
        );
      }

      // Upload food images
      if (req.files.foodImages?.length) {
        updateData.images.food = [];
        for (const file of req.files.foodImages) {
          const url = await uploadToCloudinary(file, "branch_food_images");
          updateData.images.food.push(url);
        }
      }

      // Upload menu images
      if (req.files.menuImages?.length) {
        updateData.images.menu = [];
        for (const file of req.files.menuImages) {
          const url = await uploadToCloudinary(file, "branch_menu_images");
          updateData.images.menu.push(url);
        }
      }

      // Upload FSSAI license
      if (req.files.uploadFssaiLicense) {
        if (!updateData.legalDetails) {
          updateData.legalDetails = { ...existingBranch.legalDetails };
        }
        updateData.legalDetails.uploadFssaiLicense = await uploadToCloudinary(
          req.files.uploadFssaiLicense[0],
          "branch_fssai_licenses"
        );
      }
    }

    // Update branch with new data
    const updatedBranch = await Branch.findOneAndUpdate(
      { branchId },
      { $set: updateData },
      { new: true }
    );

    res.status(200).json({
      message: "Branch updated successfully",
      branch: updatedBranch
    });

  } catch (error) {
    console.error("Error updating branch:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Delete a branch
const deleteBranch = async (req, res) => {
  try {
    const { branchId } = req.params;

    const result = await Branch.deleteOne({ branchId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Branch not found" });
    }

    res.status(200).json({ message: "Branch deleted successfully" });

  } catch (error) {
    console.error("Error deleting branch:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

module.exports = {
  addBranch,
  getBranches,
  getBranchDetails,
  updateBranch,
  deleteBranch
};