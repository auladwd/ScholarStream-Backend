import express from 'express';
import { getApplicationsCollection } from '../models/Application.js';
import { getScholarshipsCollection } from '../models/Scholarship.js';
import { getUsersCollection } from '../models/User.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { verifyModerator } from '../middleware/verifyModerator.js';
import { toObjectId, isValidObjectId } from '../db/connection.js';

const router = express.Router();

// Helper function to populate application with scholarship and user data
const populateApplication = async (application) => {
  const scholarshipsCollection = getScholarshipsCollection();
  const usersCollection = getUsersCollection();

  const scholarship = application.scholarshipId 
    ? await scholarshipsCollection.findOne({ _id: toObjectId(application.scholarshipId) })
    : null;
  
  const user = application.userId
    ? await usersCollection.findOne({ _id: toObjectId(application.userId) })
    : null;

  return {
    ...application,
    scholarshipId: scholarship ? { ...scholarship, _id: scholarship._id } : application.scholarshipId,
    userId: user ? { ...user, _id: user._id } : application.userId,
  };
};

// Get All Applications (Moderator/Admin)
router.get('/', verifyModerator, async (req, res) => {
  try {
    const applicationsCollection = getApplicationsCollection();
    const applications = await applicationsCollection
      .find()
      .sort({ applicationDate: -1 })
      .toArray();

    // Populate scholarship and user data
    const populatedApplications = await Promise.all(
      applications.map(app => populateApplication(app))
    );

    res.json(populatedApplications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications', error: error.message });
  }
});

// Get User's Applications (Student)
router.get('/my-applications', verifyToken, async (req, res) => {
  try {
    const applicationsCollection = getApplicationsCollection();
    const applications = await applicationsCollection
      .find({ userId: toObjectId(req.user._id) })
      .sort({ applicationDate: -1 })
      .toArray();

    // Populate scholarship data
    const populatedApplications = await Promise.all(
      applications.map(async (app) => {
        const scholarshipsCollection = getScholarshipsCollection();
        const scholarship = app.scholarshipId 
          ? await scholarshipsCollection.findOne({ _id: toObjectId(app.scholarshipId) })
          : null;
        
        return {
          ...app,
          scholarshipId: scholarship || app.scholarshipId,
        };
      })
    );

    res.json(populatedApplications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching applications', error: error.message });
  }
});

// Get Single Application
router.get('/:id', verifyToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    const applicationsCollection = getApplicationsCollection();
    const application = await applicationsCollection.findOne({ _id: toObjectId(req.params.id) });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Populate data
    const populatedApplication = await populateApplication(application);

    // Check if user has access
    const userIdStr = populatedApplication.userId?._id?.toString() || populatedApplication.userId?.toString();
    if (req.user.role === 'Student' && userIdStr !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(populatedApplication);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching application', error: error.message });
  }
});

// Create Application
router.post('/', verifyToken, async (req, res) => {
  try {
    const { scholarshipId } = req.body;

    if (!isValidObjectId(scholarshipId)) {
      return res.status(400).json({ message: 'Invalid scholarship ID' });
    }

    const scholarshipsCollection = getScholarshipsCollection();
    const scholarship = await scholarshipsCollection.findOne({ _id: toObjectId(scholarshipId) });
    
    if (!scholarship) {
      return res.status(404).json({ message: 'Scholarship not found' });
    }

    const applicationsCollection = getApplicationsCollection();

    // Check if already applied
    const existing = await applicationsCollection.findOne({
      scholarshipId: toObjectId(scholarshipId),
      userId: toObjectId(req.user._id)
    });

    if (existing) {
      return res.status(400).json({ message: 'Already applied for this scholarship' });
    }

    const application = {
      scholarshipId: toObjectId(scholarshipId),
      userId: toObjectId(req.user._id),
      userName: req.user.name,
      userEmail: req.user.email,
      universityName: scholarship.universityName,
      scholarshipCategory: scholarship.scholarshipCategory,
      degree: scholarship.degree,
      applicationFees: scholarship.applicationFees,
      serviceCharge: scholarship.serviceCharge,
      paymentStatus: 'unpaid',
      applicationStatus: 'pending',
      applicationDate: new Date(),
      feedback: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await applicationsCollection.insertOne(application);
    const insertedApplication = await applicationsCollection.findOne({ _id: result.insertedId });

    res.status(201).json({ message: 'Application created', application: insertedApplication });
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

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    const applicationsCollection = getApplicationsCollection();
    const result = await applicationsCollection.findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: { applicationStatus, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json({ message: 'Status updated', application: result.value });
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error.message });
  }
});

// Add Feedback (Moderator/Admin)
router.patch('/:id/feedback', verifyModerator, async (req, res) => {
  try {
    const { feedback } = req.body;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    const applicationsCollection = getApplicationsCollection();
    const result = await applicationsCollection.findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: { feedback, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json({ message: 'Feedback added', application: result.value });
  } catch (error) {
    res.status(500).json({ message: 'Error adding feedback', error: error.message });
  }
});

// Update Payment Status
router.patch('/:id/payment', verifyToken, async (req, res) => {
  try {
    const { paymentStatus } = req.body;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    const applicationsCollection = getApplicationsCollection();
    const application = await applicationsCollection.findOne({ _id: toObjectId(req.params.id) });
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user owns this application or is admin/moderator
    const userIdStr = application.userId?.toString();
    if (
      req.user.role !== 'Admin' &&
      req.user.role !== 'Moderator' &&
      userIdStr !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await applicationsCollection.findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: { paymentStatus, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    res.json({ message: 'Payment status updated', application: result.value });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment status', error: error.message });
  }
});

// Delete Application (Student - only if pending)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    const applicationsCollection = getApplicationsCollection();
    const application = await applicationsCollection.findOne({ _id: toObjectId(req.params.id) });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check ownership
    const userIdStr = application.userId?.toString();
    if (userIdStr !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Students can only delete pending applications
    if (req.user.role === 'Student' && application.applicationStatus !== 'pending') {
      return res.status(400).json({ message: 'Can only delete pending applications' });
    }

    await applicationsCollection.findOneAndDelete({ _id: toObjectId(req.params.id) });
    res.json({ message: 'Application deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting application', error: error.message });
  }
});

export default router;
