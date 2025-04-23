import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    console.log('Auth header:', authHeader);
    
    // Check if no auth header
    if (!authHeader) {
      console.log('No Authorization header found');
      return res.status(401).json({ message: 'Authorization denied, no token provided' });
    }
    
    // Extract token (removes 'Bearer ' prefix if present)
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7, authHeader.length) 
      : authHeader;
    
    console.log('Verifying token...');
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Add user from payload
    req.user = decoded;
    console.log('User authenticated with ID:', req.user.id);
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

export default auth;
