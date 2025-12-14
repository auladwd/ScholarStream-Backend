import express from 'express';
import { getApplicationsCollection } from '../models/Application.js';
import { getUsersCollection } from '../models/User.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';

const router = express.Router();

// Get Analytics (Admin only)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const usersCollection = getUsersCollection();
    const applicationsCollection = getApplicationsCollection();

    // Total Users
    const totalUsers = await usersCollection.countDocuments();

    // Users by Role
    const usersByRole = await usersCollection.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Applications by University
    const applicationsByUniversity = await applicationsCollection.aggregate([
      {
        $group: {
          _id: '$universityName',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    // Applications by Status
    const applicationsByStatus = await applicationsCollection.aggregate([
      {
        $group: {
          _id: '$applicationStatus',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Total Fees Collected
    const totalFees = await applicationsCollection.aggregate([
      {
        $match: { paymentStatus: 'paid' }
      },
      {
        $group: {
          _id: null,
          totalApplicationFees: { $sum: '$applicationFees' },
          totalServiceCharge: { $sum: '$serviceCharge' }
        }
      }
    ]).toArray();

    const feesData = totalFees[0] || { totalApplicationFees: 0, totalServiceCharge: 0 };

    res.json({
      totalUsers,
      usersByRole,
      applicationsByUniversity,
      applicationsByStatus,
      totalFees: feesData.totalApplicationFees + feesData.totalServiceCharge,
      totalApplicationFees: feesData.totalApplicationFees,
      totalServiceCharge: feesData.totalServiceCharge
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
});

export default router;
