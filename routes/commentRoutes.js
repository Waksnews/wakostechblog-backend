const express = require('express');
const {
  addComment,
  getComments,
  deleteComment,
  updateComment,
  likeComment
} = require('../controllers/commentController');

// FIXED: Import the middleware correctly
const { requireSignIn } = require('../middlewares/authMiddleware');

const router = express.Router();

// @route   POST /api/v1/comments
// @desc    Add a new comment
// @access  Private
router.post('/', requireSignIn, addComment);

// @route   GET /api/v1/comments/blog/:blogId
// @desc    Get comments for a blog
// @access  Public
router.get('/blog/:blogId', getComments);

// @route   DELETE /api/v1/comments/:id
// @desc    Delete a comment
// @access  Private
router.delete('/:id', requireSignIn, deleteComment);

// @route   PUT /api/v1/comments/:id
// @desc    Update a comment
// @access  Private
router.put('/:id', requireSignIn, updateComment);

// @route   POST /api/v1/comments/:id/like
// @desc    Like/Unlike a comment
// @access  Private
router.post('/:id/like', requireSignIn, likeComment);

module.exports = router;