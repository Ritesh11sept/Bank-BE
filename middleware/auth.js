import jwt from 'jsonwebtoken';
// If this middleware needs to access User model, update the import:
// import User from "../models/Users.js";

const auth = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    // Development mode - allow "temp_token" to bypass authentication
    if (process.env.NODE_ENV !== 'production' && token === 'temp_token') {
      // Set a temporary user for development
      req.user = { id: 'temp_user_id', isDemo: true };
      return next();
    }

    // Verify token
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      req.user = verified;
      next();
    } catch (verifyError) {
      // Special case for development mode with temp token
      if (process.env.NODE_ENV !== 'production' && 
          req.header('Authorization')?.replace('Bearer ', '') === 'temp_token') {
        req.user = { id: 'temp_user_id', isDemo: true };
        return next();
      }
      
      throw verifyError;
    }
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ message: 'Invalid token, access denied' });
  }
};

export default auth;
