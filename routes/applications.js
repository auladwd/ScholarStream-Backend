import express from 'express';
import Application from '../models/Application.js';
import Scholarship from '../models/Scholarship.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { verifyModerator } from '../middleware/verifyModerator.js';

const router = express.Router();

// Get All Applications (Moderator/Admin)
router.get('/', verifyModerator, async (req, res) => {
  try {
    const applications = await Application.find()
      .populate('scholarshipId', 'scholarshipName universityName')
      .populate('userId', 'name email photoURL')
      .sort({ applicationDate: -1 });

    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications', error: error.message });
  }
});

// Get User's Applications (Student)
router.get('/my-applications', verifyToken, async (req, res) => {
  try {
    const applications = await Application.find({ userId: req.user._id })
      .populate('scholarshipId')
      .sort({ applicationDate: -1 });

    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications', error: error.message });
  }
});

// Get Single Application
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('scholarshipId')
      .populate('userId', 'name email photoURL');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user has access
    if (req.user.role === 'Student' && application.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(application);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching application', error: error.message });
  }
});

// Create Application
router.post('/', verifyToken, async (req, res) => {
  try {
    const { scholarshipId } = req.body;

    const scholarship = await Scholarship.findById(scholarshipId);
    if (!scholarship) {
      return res.status(404).json({ message: 'Scholarship not found' });
    }

    // Check if already applied
    const existing = await Application.findOne({
      scholarshipId,
      userId: req.user._id
    });

    if (existing) {
      return res.status(400).json({ message: 'Already applied for this scholarship' });
    }

    const application = new Application({
      scholarshipId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      universityName: scholarship.universityName,
      scholarshipCategory: scholarship.scholarshipCategory,
      degree: scholarship.degree,
      applicationFees: scholarship.applicationFees,
      serviceCharge: scholarship.serviceCharge,
      paymentStatus: 'unpaid'
    });

    await application.save();
    res.status(201).json({ message: 'Application created', application });
  } catch (error) {
    res.status(500).json({ message: 'Error creating application', error: error.message });
  }
});

// Update Application Status (Moderator/Admin)
router.patch('/:id/status', verifyModerator, async (req, res) => {
  try {
    const { applicationStatus } = req.body;
    const validStatuses = ['pending', 'processing', 'completed', 'rejected'];

    if (!validStatuses.includes(applicationStatus)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { applicationStatus },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json({ message: 'Status updated', application });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
});

// Add Feedback (Moderator/Admin)
router.patch('/:id/feedback', verifyModerator, async (req, res) => {
  try {
    const { feedback } = req.body;

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { feedback },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json({ message: 'Feedback added', application });
  } catch (error) {
    res.status(500).json({ message: 'Error adding feedback', error: error.message });
  }
});

// Update Payment Status
router.patch('/:id/payment', verifyToken, async (req, res) => {
  try {
    const { paymentStatus } = req.body;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user owns this application or is admin/moderator
    if (
      req.user.role !== 'Admin' &&
      req.user.role !== 'Moderator' &&
      application.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    application.paymentStatus = paymentStatus;
    await application.save();

    res.json({ message: 'Payment status updated', application });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment status', error: error.message });
  }
});

// Delete Application (Student - only if pending)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check ownership
    if (application.userId.toString() !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Students can only delete pending applications
    if (req.user.role === 'Student' && application.applicationStatus !== 'pending') {
      return res.status(400).json({ message: 'Can only delete pending applications' });
    }

    await Application.findByIdAndDelete(req.params.id);
    res.json({ message: 'Application deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting application', error: error.message });
  }
});

export default router;

