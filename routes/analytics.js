import express from 'express';
import Application from '../models/Application.js';
import User from '../models/User.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';

const router = express.Router();

// Get Analytics (Admin only)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    // Total Users
    const totalUsers = await User.countDocuments();

    // Users by Role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Applications by University
    const applicationsByUniversity = await Application.aggregate([
      {
        $group: {
          _id: '$universityName',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Applications by Status
    const applicationsByStatus = await Application.aggregate([
      {
        $group: {
          _id: '$applicationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Total Fees Collected
    const totalFees = await Application.aggregate([
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
    ]);

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

