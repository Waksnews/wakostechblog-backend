const express = require('express');
// FIXED: Import the middleware correctly
const { requireSignIn } = require('../middlewares/authMiddleware');
const Blog = require('../models/blogModel');
const User = require('../models/userModel');
const Comment = require('../models/commentModel');
const mongoose = require('mongoose');

// NEW: Import the enhanced dashboard controllers
const {
  getDashboardData,
  getContentCalendar,
  getAnalytics
} = require('../controllers/dashboardController');

const router = express.Router();

// @route   GET /api/v1/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', requireSignIn, async (req, res) => {
  try {
    const userId = req.user.id;

    // User's blog statistics
    const userBlogs = await Blog.find({ user: userId });
    const totalBlogs = userBlogs.length;
    
    const totalLikes = userBlogs.reduce((sum, blog) => sum + blog.likesCount, 0);
    const totalComments = userBlogs.reduce((sum, blog) => sum + blog.commentCount, 0);
    
    const mostPopularBlog = await Blog.findOne({ user: userId })
      .sort({ likesCount: -1 })
      .select('title likesCount commentCount');

    // Recent activity
    const recentBlogs = await Blog.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title createdAt likesCount commentCount');

    const recentComments = await Comment.find({ 
      blog: { $in: userBlogs.map(blog => blog._id) } 
    })
    .populate('user', 'username')
    .populate('blog', 'title')
    .sort({ createdAt: -1 })
    .limit(5);

    const stats = {
      overview: {
        totalBlogs,
        totalLikes,
        totalComments,
        averageLikes: totalBlogs > 0 ? (totalLikes / totalBlogs).toFixed(1) : 0
      },
      mostPopularBlog,
      recentActivity: {
        blogs: recentBlogs,
        comments: recentComments
      }
    };

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/dashboard/analytics
// @desc    Get blog analytics
// @access  Private
router.get('/analytics', requireSignIn, async (req, res) => {
  try {
    const userId = req.user.id;

    // Monthly blog creation stats
    const monthlyStats = await Blog.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          totalLikes: { $sum: '$likesCount' },
          totalComments: { $sum: '$commentCount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Category distribution
    const categoryStats = await Blog.aggregate([
      { $match: { user: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        monthlyStats,
        categoryStats
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// NEW ROUTES FOR ENHANCED DASHBOARD FEATURES

// @route   GET /api/v1/dashboard/overview
// @desc    Get comprehensive dashboard overview with enhanced data
// @access  Private
router.get('/overview', requireSignIn, getDashboardData);

// @route   GET /api/v1/dashboard/calendar
// @desc    Get content calendar with scheduled and draft posts
// @access  Private
router.get('/calendar', requireSignIn, getContentCalendar);

// @route   GET /api/v1/dashboard/enhanced-analytics
// @desc    Get enhanced analytics with views, engagement rates, etc.
// @access  Private
router.get('/enhanced-analytics', requireSignIn, getAnalytics);

// @route   GET /api/v1/dashboard/user-stats
// @desc    Get user-specific statistics and achievements
// @access  Private
router.get('/user-stats', requireSignIn, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .select('stats profile preferences achievements')
      .populate('blogs', 'title views likesCount createdAt category');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate additional stats
    const userBlogs = user.blogs || [];
    const totalViews = userBlogs.reduce((sum, blog) => sum + (blog.views || 0), 0);
    const publishedBlogs = userBlogs.filter(blog => blog.status === 'published');
    const draftBlogs = userBlogs.filter(blog => blog.status === 'draft');

    // Calculate engagement rate
    const engagementRate = totalViews > 0 ? 
      ((user.stats.totalLikes / totalViews) * 100).toFixed(1) : 0;

    const enhancedStats = {
      basic: user.stats,
      enhanced: {
        totalViews,
        publishedCount: publishedBlogs.length,
        draftCount: draftBlogs.length,
        engagementRate: parseFloat(engagementRate),
        avgViewsPerPost: userBlogs.length > 0 ? Math.round(totalViews / userBlogs.length) : 0,
        mostPopularCategory: user.stats.mostPopularCategory || 'None'
      },
      achievements: user.achievements || [],
      joinDate: user.profile.joinDate || user.createdAt
    };

    res.status(200).json({
      success: true,
      stats: enhancedStats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;