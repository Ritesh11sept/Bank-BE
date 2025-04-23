import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    console.log('Auth header:', authHeader);
    
    // BYPASS AUTHENTICATION: Always allow requests to proceed
    // This makes all routes public without requiring authentication
    
    // If token exists, try to verify it for user identification
    if (authHeader) {
      try {
        // Extract token (removes 'Bearer ' prefix if present)
        const token = authHeader.startsWith('Bearer ') 
          ? authHeader.substring(7, authHeader.length) 
          : authHeader;
        
        console.log('Verifying token for identification purposes...');
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        
        // Add user from payload
        req.user = decoded;
        console.log('User identified with ID:', req.user.id);
      } catch (tokenError) {
        // If token verification fails, just log it
        console.log('Token verification failed, continuing as public access:', tokenError.message);
        req.user = null;
      }
    } else {
      console.log('No Authorization header found, continuing as public access');
      req.user = null;
    }
    
    // Continue with request processing regardless of auth status
    next();
  } catch (err) {
    console.error('Auth error, continuing as public access:', err.message);
    req.user = null;
    next();
  }
};

export default auth;
