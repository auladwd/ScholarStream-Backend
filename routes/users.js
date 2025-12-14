import express from 'express';
import { getUsersCollection } from '../models/User.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { toObjectId, isValidObjectId } from '../db/connection.js';

const router = express.Router();

// Get All Users (Admin only)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { role } = req.query;
    const query = role ? { role } : {};

    const usersCollection = getUsersCollection();
    const users = await usersCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Remove __v field if it exists (Mongoose legacy)
    const cleanedUsers = users.map(user => {
      const { __v, ...rest } = user;
      return rest;
    });

    res.json(cleanedUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// Get Single User
router.get('/:id', verifyToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({ _id: toObjectId(req.params.id) });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove __v field if it exists
    const { __v, ...cleanedUser } = user;

    // Users can only view their own profile unless admin
    if (req.user.role !== 'Admin' && user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(cleanedUser);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
});

// Update User Role (Admin only)
router.patch('/:id/role', verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['Student', 'Moderator', 'Admin'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const usersCollection = getUsersCollection();
    const result = await usersCollection.findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: { role, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Role updated', user: result.value });
  } catch (error) {
    res.status(500).json({ message: 'Error updating role', error: error.message });
  }
});

// Delete User (Admin only)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const usersCollection = getUsersCollection();
    const result = await usersCollection.findOneAndDelete({ _id: toObjectId(req.params.id) });

    if (!result.value) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
});

// Update User Profile
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Users can only update their own profile unless admin
    if (req.params.id !== req.user._id.toString() && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const usersCollection = getUsersCollection();
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };

    const result = await usersCollection.findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile updated', user: result.value });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

export default router;
