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
const profileRoutes = require("./routes/profileRoutes");

//mongodb connection
connectDB();

//rest object
const app = express();

//middlewares
// CORS configuration - UPDATED for Vercel deployment
app.use(cors({
  origin: [
    'https://wakostech-blog-frontend.vercel.app', // Your Vercel frontend URL
    'http://localhost:3000', // For local development
    'https://wakostech-blog-frontend-git-main-wako-roba.vercel.app' // Vercel preview deployments
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan("combined"));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/blog", blogRoutes);
app.use("/api/v1/comments", commentRoutes);
app.use("/api/v1/newsletter", newsletterRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/", sitemapRoutes);

// Debug route
app.get("/api/v1/debug-routes", (req, res) => {
  const routes = [
    { path: '/api/v1/user/login', method: 'POST', mounted: true },
    { path: '/api/v1/user/register', method: 'POST', mounted: true },
    { path: '/api/v1/user/all-users', method: 'GET', mounted: true }
  ];
  res.json({ 
    message: "Debug routes check",
    userRoutes: routes,
    allEndpoints: ["/api/v1/user/login", "/api/v1/user/register", "/api/v1/user/all-users"]
  });
});

// Health check route - IMPORTANT for Railway
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    features: {
      profile: "enhanced",
      dashboard: "enhanced",
      analytics: "enabled"
    }
  });
});

// Root route
app.get("/", (req, res) => {
  res.status(200).send({
    success: true,
    message: "Welcome to WakosTech Blog App API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    deployed: true,
    endpoints: {
      users: "/api/v1/user",
      blogs: "/api/v1/blog",
      comments: "/api/v1/comments",
      newsletter: "/api/v1/newsletter",
      dashboard: "/api/v1/dashboard",
      profile: "/api/v1/profile",
      health: "/api/v1/health"
    },
    documentation: "API documentation available at root endpoint"
  });
});

// Error handling middleware for undefined routes
app.use("*", (req, res) => {
  res.status(404).send({
    success: false,
    message: "Route not found",
    requestedUrl: req.originalUrl,
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
  console.error('Error Stack:', err.stack);

  if (res.headersSent) {
    return next(err);
  }

  // Default to 500 if no status code
  const statusCode = err.status || 500;
  
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { 
      stack: err.stack,
      error: err 
    })
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Unhandled Rejection: ${err.message}`.red);
  console.log(err.stack);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`Uncaught Exception: ${err.message}`.red);
  console.log(err.stack);
  process.exit(1);
});

// Port - Railway will provide PORT environment variable
const PORT = process.env.PORT || 8080;

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `\n🚀 Server Running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`.bgCyan.white
  );
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`.gray);
  console.log(`📊 Database: ${process.env.MONGO_URL ? "Connected" : "Not configured"}`.gray);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`.gray);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/v1/health`.gray);
  console.log(`✨ Enhanced Features:`.green);
  console.log(`   👤 User Profiles with social links & preferences`.green);
  console.log(`   📊 Advanced Dashboard with analytics`.green);
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