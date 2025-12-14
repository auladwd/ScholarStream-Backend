import { verifyToken } from './verifyToken.js';

export const verifyModerator = async (req, res, next) => {
  // First verify the token
  await verifyToken(req, res, () => {
    // After token verification, check role
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    if (req.user.role !== 'Moderator' && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Moderator access required' });
    }
    
    next();
  });
};

