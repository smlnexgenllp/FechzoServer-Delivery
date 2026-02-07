const Rating = require('../../../models/restaurants/RatingModels');
const mongoose = require('mongoose');

// Get reviews for a restaurant
exports.getReviewsByRestaurant = async (req, res) => {
  try {
    const { id } = req.query; // Get restaurantId from query parameter
    if (!id) {
      return res.status(400).json({ message: 'Restaurant ID is required' });
    }

    const reviews = await Rating.find({ restaurantId: id })
      .populate('userId', 'name image') // Populate user details
      .sort({ createdAt: -1 }); // Sort by newest first

    // Format reviews to match frontend expectations
    const formattedReviews = reviews.map((review) => ({
      _id: review._id,
      userName: review.userId?.name || 'Anonymous',
      userImage: review.userId?.image || 'https://via.placeholder.com/40',
      rating: review.rating,
      review: review.review,
      createdAt: review.createdAt,
      helpfulCount: review.helpfulCount,
      isHelpful: false, // No user context, so default to false
      orderItems: [], // Add logic if orderItems are stored elsewhere
      images: [] // Add logic if images are stored
    }));

    // Calculate restaurant rating and review count
    const reviewCount = reviews.length;
    const averageRating =
      reviewCount > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
        : 0;

    res.status(200).json({
      reviews: formattedReviews,
      restaurant: {
        rating: averageRating,
        reviewCount
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.markReviewHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { markAsHelpful } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    if (typeof markAsHelpful !== 'boolean') {
      return res.status(400).json({ message: 'markAsHelpful must be a boolean' });
    }

    const review = await Rating.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Update helpfulCount based on markAsHelpful
    if (markAsHelpful) {
      review.helpfulCount += 1;
    } else {
      review.helpfulCount = Math.max(0, review.helpfulCount - 1); // Prevent negative count
    }

    await review.save();

    res.status(200).json({
      message: 'Helpful status updated',
      helpfulCount: review.helpfulCount,
      isHelpful: markAsHelpful
    });
  } catch (error) {
    console.error('Error marking review helpful:', error);
    res.status(500).json({ message: 'Server error' });
  }
};