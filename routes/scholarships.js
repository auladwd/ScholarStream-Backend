import express from 'express';
import { getScholarshipsCollection } from '../models/Scholarship.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';
import { toObjectId, isValidObjectId } from '../db/connection.js';

const router = express.Router();

// Get All Scholarships with Search, Filter, Sort, Pagination
router.get('/', async (req, res) => {
  try {
    const {
      search,
      country,
      subjectCategory,
      scholarshipCategory,
      sortBy,
      sortOrder,
      page = 1,
      limit = 12
    } = req.query;

    const query = {};

    // Search
    if (search) {
      query.$or = [
        { scholarshipName: { $regex: search, $options: 'i' } },
        { universityName: { $regex: search, $options: 'i' } },
        { degree: { $regex: search, $options: 'i' } }
      ];
    }

    // Filters
    if (country) {
      query.universityCountry = country;
    }
    if (subjectCategory) {
      query.subjectCategory = subjectCategory;
    }
    if (scholarshipCategory) {
      query.scholarshipCategory = scholarshipCategory;
    }

    // Sort
    let sort = {};
    if (sortBy === 'applicationFees') {
      sort.applicationFees = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'postDate') {
      sort.scholarshipPostDate = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.scholarshipPostDate = -1; // Default: newest first
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const scholarshipsCollection = getScholarshipsCollection();
    const scholarships = await scholarshipsCollection
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await scholarshipsCollection.countDocuments(query);

    res.json({
      scholarships,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching scholarships', error: error.message });
  }
});

// Get Top 6 Scholarships (lowest fees or recent)
router.get('/top', async (req, res) => {
  try {
    const scholarshipsCollection = getScholarshipsCollection();
    const scholarships = await scholarshipsCollection
      .find()
      .sort({ applicationFees: 1, scholarshipPostDate: -1 })
      .limit(6)
      .toArray();

    res.json(scholarships);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching top scholarships', error: error.message });
  }
});

// Get Single Scholarship
router.get('/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid scholarship ID' });
    }

    const scholarshipsCollection = getScholarshipsCollection();
    const scholarship = await scholarshipsCollection.findOne({ _id: toObjectId(req.params.id) });
    
    if (!scholarship) {
      return res.status(404).json({ message: 'Scholarship not found' });
    }
    res.json(scholarship);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching scholarship', error: error.message });
  }
});

// Create Scholarship (Admin only)
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const scholarship = {
      ...req.body,
      postedUserEmail: req.user.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const scholarshipsCollection = getScholarshipsCollection();
    const result = await scholarshipsCollection.insertOne(scholarship);
    const insertedScholarship = await scholarshipsCollection.findOne({ _id: result.insertedId });

    res.status(201).json({ message: 'Scholarship created successfully', scholarship: insertedScholarship });
  } catch (error) {
    res.status(500).json({ message: 'Error creating scholarship', error: error.message });
  }
});

// Update Scholarship (Admin only)
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid scholarship ID' });
    }

    const scholarshipsCollection = getScholarshipsCollection();
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
    };

    const result = await scholarshipsCollection.findOneAndUpdate(
      { _id: toObjectId(req.params.id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ message: 'Scholarship not found' });
    }
    res.json({ message: 'Scholarship updated successfully', scholarship: result.value });
  } catch (error) {
    res.status(500).json({ message: 'Error updating scholarship', error: error.message });
  }
});

// Delete Scholarship (Admin only)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid scholarship ID' });
    }

    const scholarshipsCollection = getScholarshipsCollection();
    const result = await scholarshipsCollection.findOneAndDelete({ _id: toObjectId(req.params.id) });

    if (!result.value) {
      return res.status(404).json({ message: 'Scholarship not found' });
    }
    res.json({ message: 'Scholarship deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting scholarship', error: error.message });
  }
});

export default router;
