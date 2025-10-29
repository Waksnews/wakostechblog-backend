const Comment = require('../models/commentModel');
const Blog = require('../models/blogModel');

// @desc    Add a new comment
// @route   POST /api/v1/comments
// @access  Private
const addComment = async (req, res) => {
  try {
    const { content, blogId, parentCommentId } = req.body;
    
    // FIXED: Use req.user.id instead of req.user._id
    const userId = req.user.id;

    // Check if blog exists
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).send({
        success: false,
        message: 'Blog not found'
      });
    }

    // Validate required fields
    if (!content || !blogId) {
      return res.status(400).send({
        success: false,
        message: 'Content and blogId are required'
      });
    }

    const comment = new Comment({
      content,
      blog: blogId,
      user: userId,
      parentComment: parentCommentId || null
    });

    await comment.save();

    // Populate user info
    await comment.populate('user', 'username email');

    // Update blog comment count (only for top-level comments)
    if (!parentCommentId) {
      blog.commentCount = await Comment.countDocuments({
        blog: blogId,
        parentComment: null
      });
      await blog.save();
    }

    res.status(201).send({
      success: true,
      message: 'Comment added successfully',
      comment
    });
  } catch (error) {
    console.error('Comment creation error:', error);
    res.status(500).send({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get comments for a blog
// @route   GET /api/v1/comments/blog/:blogId
// @access  Public
const getComments = async (req, res) => {
  try {
    const { blogId } = req.params;
    
    const comments = await Comment.find({ 
      blog: blogId,
      parentComment: null 
    })
    .populate('user', 'username email')
    .populate({
      path: 'replies',
      populate: {
        path: 'user',
        select: 'username email'
      },
      options: { sort: { createdAt: 1 } }
    })
    .sort({ createdAt: -1 });

    res.status(200).send({
      success: true,
      comments
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/v1/comments/:id
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findById(id);
    
    if (!comment) {
      return res.status(404).send({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user owns the comment
    if (comment.user.toString() !== userId.toString()) {
      return res.status(403).send({
        success: false,
        message: 'Not authorized to delete this comment'
      });
    }

    // Delete all replies first
    await Comment.deleteMany({ parentComment: id });
    
    // Delete the comment
    await Comment.findByIdAndDelete(id);

    // Update blog comment count (only for top-level comments)
    if (!comment.parentComment) {
      const blog = await Blog.findById(comment.blog);
      if (blog) {
        blog.commentCount = await Comment.countDocuments({
          blog: comment.blog,
          parentComment: null
        });
        await blog.save();
      }
    }

    res.status(200).send({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update a comment
// @route   PUT /api/v1/comments/:id
// @access  Private
const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const comment = await Comment.findById(id);
    
    if (!comment) {
      return res.status(404).send({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check if user owns the comment
    if (comment.user.toString() !== userId.toString()) {
      return res.status(403).send({
        success: false,
        message: 'Not authorized to edit this comment'
      });
    }

    comment.content = content;
    comment.isEdited = true;
    await comment.save();

    await comment.populate('user', 'username email');

    res.status(200).send({
      success: true,
      message: 'Comment updated successfully',
      comment
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Like/Unlike a comment
// @route   POST /api/v1/comments/:id/like
// @access  Private
const likeComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findById(id);
    
    if (!comment) {
      return res.status(404).send({
        success: false,
        message: 'Comment not found'
      });
    }

    const isLiked = comment.likes.includes(userId);
    
    if (isLiked) {
      // Unlike
      comment.likes = comment.likes.filter(like => like.toString() !== userId.toString());
    } else {
      // Like
      comment.likes.push(userId);
    }

    await comment.save();

    res.status(200).send({
      success: true,
      message: isLiked ? 'Comment unliked' : 'Comment liked',
      likesCount: comment.likes.length,
      isLiked: !isLiked
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  addComment,
  getComments,
  deleteComment,
  updateComment,
  likeComment
};