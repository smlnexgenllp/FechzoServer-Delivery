const Rating = require('../../../models/restaurants/RatingModels');
const User = require('../../../models/User/User'); // Adjust path if needed

// Get all reviews (no filtering)
exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Rating.find({})
      .sort({ createdAt: -1 }) // latest first
      .populate({
        path: 'userId',
        select: 'name profilePicture'
      });

    const formattedReviews = reviews.map((review) => {
      const userName = review.userId?.name || "Anonymous";
      const userImage = review.userId?.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`;
      const formattedDate = new Date(review.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      return {
        userName,
        userImage,
        rating: review.rating,
        comment: review.review,
        foodId: review.foodId,
        restaurantId: review.restaurantId,
        reviewDate: formattedDate,
        verified: true
      };
    });

    res.status(200).json(formattedReviews);
  } catch (error) {
    console.error('Error fetching all reviews:', error);
    res.status(500).json({ message: 'Failed to fetch all reviews' });
  }
};
