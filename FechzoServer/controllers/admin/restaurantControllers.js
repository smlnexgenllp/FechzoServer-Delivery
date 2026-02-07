const Restaurant = require('../../models/restaurants/shops/RestaurantDetails');
const Branch = require('../../models/restaurants/shops/BranchDetails'); // Import Branch model

// Fetch all restaurants with their branches
const getRestaurants = async (req, res) => {
    try {
        // Get all restaurants
        const restaurants = await Restaurant.find();
        
        // For each restaurant, fetch its branches
        const restaurantsWithBranches = await Promise.all(
            restaurants.map(async (restaurant) => {
                // Find branches for this restaurant
                const branches = await Branch.find({ 
                    restaurantId: restaurant.restaurantId 
                });
                
                // Convert Mongoose document to plain object and add branches
                const restaurantObj = restaurant.toObject();
                restaurantObj.branches = branches;
                
                return restaurantObj;
            })
        );
        
        res.status(200).json(restaurantsWithBranches);
    } catch (error) {
        console.error("Error fetching restaurants:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Approve a restaurant
// ✅ Approve Restaurant & Update Commission
const approveRestaurant = async (req, res) => {
    try {
        const { approvalStatus, commissionPercentage } = req.body;
        const { id } = req.params;

        const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            id,
            { approvalStatus, commissionPercentage },
            { new: true } // Return updated document
        );

        if (!updatedRestaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        res.status(200).json(updatedRestaurant);
    } catch (error) {
        console.error("Error approving restaurant:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// ✅ Reject Restaurant (No Commission Update Needed)
const rejectRestaurant = async (req, res) => {
    try {
        const { approvalStatus, rejectionReason } = req.body;
        const { id } = req.params;

        if (approvalStatus !== "Rejected") {
            return res.status(400).json({ message: "Invalid approval status" });
        }

        if (!rejectionReason || !rejectionReason.trim()) {
            return res.status(400).json({ message: "Rejection reason is required" });
        }

        const updatedRestaurant = await Restaurant.findByIdAndUpdate(
            id,
            { approvalStatus, rejectionReason },
            { new: true, runValidators: true }
        );

        if (!updatedRestaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        res.status(200).json(updatedRestaurant);
    } catch (error) {
        console.error("Error rejecting restaurant:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update branch approval status
const updateBranchApproval = async (req, res) => {
    try {
        const { branchId } = req.params;
        const { approvalStatus, rejectionReason } = req.body;

        // Find branch directly in Branch collection
        const branch = await Branch.findOne({ branchId });
        if (!branch) {
            return res.status(404).json({ message: "Branch not found" });
        }

        // Update branch approval status
        branch.approvalStatus = approvalStatus;

        // Add rejection reason if provided
        if (approvalStatus === "Rejected" && rejectionReason) {
            branch.rejectionReason = rejectionReason;
        }

        // Save the updated branch
        await branch.save();

        res.status(200).json({
            message: `Branch ${approvalStatus.toLowerCase()} successfully`,
            branch
        });
    } catch (error) {
        console.error(`Error updating branch approval status:`, error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Get restaurant name by ID
const getRestaurantName = async (req, res) => {
    try {
        const { id } = req.params;

        const restaurant = await Restaurant.findById(id).select('restaurantName');
        
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found" });
        }

        res.status(200).json({ restaurantName: restaurant.restaurantName });
    } catch (error) {
        console.error("Error fetching restaurant name:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

module.exports = {
    getRestaurants,
    approveRestaurant,
    rejectRestaurant,
    updateBranchApproval,
    getRestaurantName
};
