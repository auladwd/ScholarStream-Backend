import jwt from 'jsonwebtoken';
import { getUsersCollection } from '../models/User.js';
import { toObjectId, isValidObjectId } from '../db/connection.js';

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!isValidObjectId(decoded.userId)) {
      return res.status(401).json({ message: 'Invalid user ID' });
    }

    const usersCollection = getUsersCollection();
    const user = await usersCollection.findOne({ _id: toObjectId(decoded.userId) });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
