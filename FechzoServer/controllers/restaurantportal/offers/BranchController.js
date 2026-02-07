// controllers/branches/BranchController.js
const Branch = require('../../../models/offers/Branch'); // Adjust the path as necessary

exports.getBranchesByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const branches = await Branch.find({ restaurantId }); // restaurantId is a string
    if (!branches || branches.length === 0) {
      return res.status(404).json({ message: 'No branches found for this restaurant' });
    }
    res.status(200).json(branches);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch branches', error: error.message });
  }
};