const JWT = require("jsonwebtoken");

const requireSignIn = async (req, res, next) => {
  try {
    // Get authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).send({
        success: false,
        message: "Authorization header required",
      });
    }

    // Handle both "Bearer token" and "token" formats
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).send({
        success: false,
        message: "Token not found",
      });
    }

    // Verify token
    const decode = JWT.verify(token, process.env.JWT_SECRET);
    req.user = decode;
    next();
  } catch (error) {
    console.log("Auth Middleware Error:", error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).send({
        success: false,
        message: "Invalid token - Please login again",
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).send({
        success: false,
        message: "Token expired - Please login again",
      });
    }

    res.status(401).send({
      success: false,
      message: "Authentication failed",
    });
  }
};

module.exports = { requireSignIn };