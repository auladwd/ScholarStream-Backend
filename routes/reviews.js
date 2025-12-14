import express from 'express';
import Review from '../models/Review.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { verifyModerator } from '../middleware/verifyModerator.js';

const router = express.Router();

// Get All Reviews for a Scholarship
router.get('/scholarship/:scholarshipId', async (req, res) => {
  try {
    const reviews = await Review.find({ scholarshipId: req.params.scholarshipId })
      .sort({ reviewDate: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

// Get All Reviews (Moderator/Admin)
router.get('/', verifyModerator, async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('scholarshipId', 'scholarshipName')
      .sort({ reviewDate: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

// Get User's Reviews
router.get('/my-reviews', verifyToken, async (req, res) => {
  try {
    const reviews = await Review.find({ userEmail: req.user.email })
      .populate('scholarshipId')
      .sort({ reviewDate: -1 });

    res.json(reviews);
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

    // Check if user has completed application for this scholarship
    const Application = (await import('../models/Application.js')).default;
    const application = await Application.findOne({
      scholarshipId,
      userEmail: req.user.email,
      applicationStatus: 'completed'
    });

    if (!application) {
      return res.status(400).json({ message: 'You can only review scholarships you have completed applications for' });
    }

    // Check if already reviewed
    const existing = await Review.findOne({
      scholarshipId,
      userEmail: req.user.email
    });

    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this scholarship' });
    }

    const review = new Review({
      scholarshipId,
      universityName: application.universityName,
      userName: req.user.name,
      userEmail: req.user.email,
      userImage: req.user.photoURL,
      ratingPoint,
      reviewComment
    });

    await review.save();
    res.status(201).json({ message: 'Review created', review });
  } catch (error) {
    res.status(500).json({ message: 'Error creating review', error: error.message });
  }
});

// Update Review
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userEmail !== req.user.email && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updated = await Review.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({ message: 'Review updated', review: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating review', error: error.message });
  }
});

// Delete Review
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.userEmail !== req.user.email && req.user.role !== 'Admin' && req.user.role !== 'Moderator') {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting review', error: error.message });
  }
});

export default router;

