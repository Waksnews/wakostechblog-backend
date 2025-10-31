const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const colors = require("colors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const path = require("path");

//env config
dotenv.config();

//router import
const userRoutes = require("./routes/userRoutes");
const blogRoutes = require("./routes/blogRoutes");
const commentRoutes = require("./routes/commentRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const sitemapRoutes = require("./routes/sitemapRoutes");
// NEW: Import profile routes
const profileRoutes = require("./routes/profileRoutes");

//mongodb connection
connectDB();

//rest object
const app = express();

//middlewares
// CORS configuration
app.use(cors({
  origin: [
    'https://wakostech-blog-frontend.onrender.com', // Your Render frontend URL
    'http://localhost:3000' // For local development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan("dev"));

// Serve static files from uploads directory - ADD THIS LINE
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//routes
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/blog", blogRoutes);
app.use("/api/v1/comments", commentRoutes);
app.use("/api/v1/newsletter", newsletterRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
// NEW: Add profile routes
app.use("/api/v1/profile", profileRoutes);
app.use("/", sitemapRoutes); // For sitemap.xml and robots.txt

// Health check route
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.DEV_MODE || "development",
    // NEW: Added enhanced features status
    features: {
      profile: "enhanced",
      dashboard: "enhanced",
      analytics: "enabled"
    }
  });
});

// Root route - works for both development and production
app.get("/", (req, res) => {
  res.status(200).send({
    success: true,
    message: "Welcome to MERN Stack Blog App API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      users: "/api/v1/user",
      blogs: "/api/v1/blog",
      comments: "/api/v1/comments",
      newsletter: "/api/v1/newsletter",
      dashboard: "/api/v1/dashboard",
      // NEW: Added profile endpoint
      profile: "/api/v1/profile",
      health: "/api/v1/health"
    },
    // NEW: Enhanced features info
    enhancedFeatures: {
      profile: "User profiles with social links, bio, and preferences",
      dashboard: "Advanced analytics and content calendar",
      analytics: "Engagement metrics and performance tracking"
    }
  });
});

// Error handling middleware for undefined routes
app.use("*", (req, res) => {
  res.status(404).send({
    success: false,
    message: "Route not found",
    requestedUrl: req.originalUrl,
    // NEW: Suggest available endpoints
    availableEndpoints: [
      "/api/v1/user",
      "/api/v1/blog", 
      "/api/v1/comments",
      "/api/v1/newsletter",
      "/api/v1/dashboard",
      "/api/v1/profile",
      "/api/v1/health"
    ]
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Check if headers have already been sent
  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.DEV_MODE === "development" && { stack: err.stack })
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`Error: ${err.message}`.red);
  process.exit(1);
});

// Port
const PORT = process.env.PORT || 8080;

// Start server
const server = app.listen(PORT, () => {
  console.log(
    `\n🚀 Server Running on ${process.env.DEV_MODE} mode on port ${PORT}`.bgCyan.white
  );
  console.log(`📁 Static files served from: ${path.join(__dirname, "uploads")}`.gray);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`.gray);
  console.log(`🗄️ Database: ${process.env.MONGO_URL ? "Connected" : "Not configured"}`.gray);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`.gray);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/v1/health`.gray);
  console.log(`📚 API Documentation available at root endpoint`.gray);
  // NEW: Enhanced features announcement
  console.log(`✨ Enhanced Features:`.green);
  console.log(`   👤 User Profiles with social links & preferences`.green);
  console.log(`   📊 Advanced Dashboard with analytics`.green);
  console.log(`   📅 Content Calendar & engagement metrics`.green);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Received SIGINT. Shutting down gracefully...".yellow);
  server.close(() => {
    console.log("💤 Server closed.".green);
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n👋 Received SIGTERM. Shutting down gracefully...".yellow);
  server.close(() => {
    console.log("💤 Server closed.".green);
    process.exit(0);
  });
});

module.exports = app;