const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const {
  getAllBlogsController,
  createBlogController,
  updateBlogController,
  getBlogByIdController,
  deleteBlogController,
  userBlogControlller,
  getUserBlogsByIdController,
  likeBlogController,
  favoriteBlogController,
  getPopularBlogsController,
  getBlogsByCategoryController,
  getUserBlogStatsController,
  uploadEditorImageController
} = require("../controllers/blogController");
const { requireSignIn } = require("../middlewares/authMiddleware");

const router = express.Router();

// CREATE UPLOADS DIRECTORY IF IT DOESN'T EXIST
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Uploads directory created');
}

// MULTER SETUP FOR FILE UPLOADS
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, 'blog-' + uniqueSuffix + fileExtension);
  }
});

// MULTER SETUP FOR EDITOR IMAGES (Smaller size limit)
const editorStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, 'editor-' + uniqueSuffix + fileExtension);
  }
});

// FILE FILTER FOR IMAGES ONLY
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for featured images
  }
});

const editorUpload = multer({ 
  storage: editorStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for editor images
  }
});

// ==================== HTML SANITIZATION MIDDLEWARE ====================

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Middleware to sanitize HTML content
const sanitizeHtmlContent = (req, res, next) => {
  if (req.body.description) {
    try {
      // Sanitize HTML content to prevent XSS attacks
      const sanitizedHtml = DOMPurify.sanitize(req.body.description, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'code',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li',
          'a', 'img',
          'span', 'div',
          'pre', 'code'
        ],
        ALLOWED_ATTR: [
          'href', 'target', 'rel', // for links
          'src', 'alt', 'title', 'width', 'height', 'style', 'class', // for images and styling
          'color', 'background'
        ],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      });
      
      req.body.description = sanitizedHtml;
      
      // Additional validation for content length (after stripping HTML tags)
      const textContent = sanitizedHtml.replace(/<[^>]*>/g, '').trim();
      if (textContent.length < 10) {
        return res.status(400).json({
          success: false,
          message: "Blog content is too short. Please add more content."
        });
      }
      
    } catch (error) {
      console.error('HTML sanitization error:', error);
      return res.status(400).json({
        success: false,
        message: "Invalid content format. Please check your blog content."
      });
    }
  }
  
  next();
};

// ==================== PUBLIC ROUTES ====================

// GET ALL BLOGS || GET
router.get("/all-blog", getAllBlogsController);

// GET SINGLE BLOG DETAILS || GET
router.get("/get-blog/:id", getBlogByIdController);

// GET USER BLOGS BY ID (PUBLIC) || GET
router.get("/user-blog/:id", getUserBlogsByIdController);

// GET POPULAR BLOGS || GET
router.get("/popular", getPopularBlogsController);

// GET BLOGS BY CATEGORY || GET
router.get("/category/:category", getBlogsByCategoryController);

// ==================== PROTECTED ROUTES ====================

// CREATE BLOG || POST - WITH FILE UPLOAD AND HTML SANITIZATION
router.post("/create-blog", 
  requireSignIn, 
  upload.single('image'), 
  sanitizeHtmlContent,
  createBlogController
);

// UPDATE BLOG || PUT - WITH OPTIONAL FILE UPLOAD AND HTML SANITIZATION
router.put("/update-blog/:id", 
  requireSignIn, 
  upload.single('image'), 
  sanitizeHtmlContent,
  updateBlogController
);

// DELETE BLOG || DELETE
router.delete("/delete-blog/:id", requireSignIn, deleteBlogController);

// GET CURRENT USER BLOGS (PROTECTED) || GET
router.get("/user-blog", requireSignIn, userBlogControlller);

// GET USER BLOG STATISTICS || GET
router.get("/user-stats", requireSignIn, getUserBlogStatsController);

// LIKE/UNLIKE BLOG || POST
router.post("/like-blog/:id", requireSignIn, likeBlogController);

// ADD/REMOVE FAVORITE || POST
router.post("/favorite-blog/:id", requireSignIn, favoriteBlogController);

// UPLOAD EDITOR IMAGE || POST
router.post("/upload-editor-image", 
  requireSignIn, 
  editorUpload.single('image'),
  uploadEditorImageController
);

// ==================== ERROR HANDLING MIDDLEWARE ====================

// Multer error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const fileType = req.originalUrl.includes('editor-image') ? 'Editor image' : 'File';
      const maxSize = req.originalUrl.includes('editor-image') ? '2MB' : '5MB';
      
      return res.status(400).json({
        success: false,
        message: `${fileType} too large. Maximum size is ${maxSize}.`
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field. Please check your file upload field name.'
      });
    }
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next();
});

// Route not found handler
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

module.exports = router;