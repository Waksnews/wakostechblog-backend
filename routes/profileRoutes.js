const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  getPublicProfile
} = require('../controllers/profileController');
const { requireSignIn } = require('../middlewares/authMiddleware');

// Import your existing multer configuration (should work now with Cloudinary)
const upload = require('../config/multer');

// @route   GET /api/v1/profile
// @desc    Get user profile
// @access  Private
router.get('/', requireSignIn, getUserProfile);

// @route   PUT /api/v1/profile
// @desc    Update user profile
// @access  Private
router.put('/', requireSignIn, updateUserProfile);

// @route   POST /api/v1/profile/picture
// @desc    Upload profile picture using Cloudinary
// @access  Private
router.post('/picture', requireSignIn, upload.single('avatar'), uploadProfilePicture);

// @route   GET /api/v1/profile/:userId
// @desc    Get public profile (for other users)
// @access  Public
router.get('/:userId', getPublicProfile);

module.exports = router;