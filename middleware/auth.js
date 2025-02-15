export const auth = (req, res, next) => {
  // For development, set a mock user ID as string
  req.user = { id: 'user123' }; // Changed from '123456789' to 'user123'
  next();
};
