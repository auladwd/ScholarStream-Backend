import express from 'express';
import { getReviewsCollection } from '../models/Review.js';
import { getApplicationsCollection } from '../models/Application.js';
import { getScholarshipsCollection } from '../models/Scholarship.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { verifyModerator } from '../middleware/verifyModerator.js';
import { toObjectId, isValidObjectId } from '../db/connection.js';

const router = express.Router();

// Get All Reviews for a Scholarship
router.get('/scholarship/:scholarshipId', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.scholarshipId)) {
      return res.status(400).json({ message: 'Invalid scholarship ID' });
    }

    const reviewsCollection = getReviewsCollection();
    const reviews = await reviewsCollection
      .find({ scholarshipId: toObjectId(req.params.scholarshipId) })
      .sort({ reviewDate: -1 })
      .toArray();

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

// Get All Reviews (Moderator/Admin)
router.get('/', verifyModerator, async (req, res) => {
  try {
    const reviewsCollection = getReviewsCollection();
    const scholarshipsCollection = getScholarshipsCollection();
    
    const reviews = await reviewsCollection
      .find()
      .sort({ reviewDate: -1 })
      .toArray();

    // Populate scholarship data
    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        const scholarship = review.scholarshipId
          ? await scholarshipsCollection.findOne({ _id: toObjectId(review.scholarshipId) })
          : null;
        
        return {
          ...review,
          scholarshipId: scholarship 
            ? { _id: scholarship._id, scholarshipName: scholarship.scholarshipName }
            : review.scholarshipId,
        };
      })
    );

    res.json(populatedReviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

// Get User's Reviews
router.get('/my-reviews', verifyToken, async (req, res) => {
  try {
    const reviewsCollection = getReviewsCollection();
    const reviews = await reviewsCollection
      .find({ userEmail: req.user.email })
      .sort({ reviewDate: -1 })
      .toArray();

    // Populate scholarship data
    const scholarshipsCollection = getScholarshipsCollection();
    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        const scholarship = review.scholarshipId
          ? await scholarshipsCollection.findOne({ _id: toObjectId(review.scholarshipId) })
          : null;
        
        return {
          ...review,
          scholarshipId: scholarship || review.scholarshipId,
        };
      })
    );

    res.json(populatedReviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

// Create Review
router.post('/', verifyToken, async (req, res) => {
  try {
    const { scholarshipId, ratingPoint, reviewComment } = req.body;

    if (!scholarshipId || !ratingPoint || !reviewComment) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!isValidObjectId(scholarshipId)) {
      return res.status(400).json({ message: 'Invalid scholarship ID' });
    }

    // Check if user has completed application for this scholarship
    const applicationsCollection = getApplicationsCollection();
    const application = await applicationsCollection.findOne({
      scholarshipId: toObjectId(scholarshipId),
      userEmail: req.user.email,
      applicationStatus: 'completed'
    });

    if (!application) {
      return res.status(400).json({ message: 'You can only review scholarships you have completed applications for' });
    }

    const reviewsCollection = getReviewsCollection();

    // Check if already reviewed
    const existing = await reviewsCollection.findOne({
      scholarshipId: toObjectId(scholarshipId),
      userEmail: req.user.email
    });

    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this scholarship' });
    }

    const review = {
      scholarshipId: toObjectId(scholarshipId),
      universityName: application.universityName,
      userName: req.user.name,
      userEmail: req.user.email,
      userImage: req.user.photoURL,
      ratingPoint,
      reviewComment,
      reviewDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await reviewsCollection.insertOne(review);
    const insertedReview = await reviewsCollection.findOne({ _id: result.insertedId });

    res.status(201).json({ message: 'Review created', review: insertedReview });
  } catch (error) {
    res.status(500).json({ message: 'Error creating review', error: error.message });
  }
});

// Update Review
router.put('/:id', verifyToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const reviewsCollection = getReviewsCollection();
    const review = await reviewsCollection.findOne({ _id: toObjectId(req.params.id) });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userEmail !== req.user.email && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };

    const result = await reviewsCollection.findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    res.json({ message: 'Review updated', review: result.value });
  } catch (error) {
    res.status(500).json({ message: 'Error updating review', error: error.message });
  }
});

// Delete Review
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const reviewsCollection = getReviewsCollection();
    const review = await reviewsCollection.findOne({ _id: toObjectId(req.params.id) });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userEmail !== req.user.email && req.user.role !== 'Admin' && req.user.role !== 'Moderator') {
      return res.status(403).json({ message: 'Access denied' });
    }

    await reviewsCollection.findOneAndDelete({ _id: toObjectId(req.params.id) });
    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting review', error: error.message });
  }
});

export default router;
