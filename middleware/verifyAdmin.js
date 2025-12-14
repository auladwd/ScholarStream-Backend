import { verifyToken } from './verifyToken.js';

export const verifyAdmin = async (req, res, next) => {
  await verifyToken(req, res, () => {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  });
};

