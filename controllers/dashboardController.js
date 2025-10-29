const Blog = require('../models/blogModel');
const User = require('../models/userModel');
const Comment = require('../models/commentModel');
const asyncHandler = require('express-async-handler');

// Get comprehensive dashboard data
const getDashboardData = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get user's blogs with full details
  const userBlogs = await Blog.find({ user: userId })
    .sort({ createdAt: -1 });
  
  // Calculate stats
  const totalBlogs = userBlogs.length;
  const totalViews = userBlogs.reduce((sum, blog) => sum + (blog.views || 0), 0);
  const totalLikes = userBlogs.reduce((sum, blog) => sum + (blog.likesCount || 0), 0);
  
  // Get blogs by status
  const publishedBlogs = userBlogs.filter(blog => blog.status === 'published');
  const draftBlogs = userBlogs.filter(blog => blog.status === 'draft');
  const scheduledBlogs = userBlogs.filter(blog => blog.status === 'scheduled');

  // Get recent comments on user's blogs
  const recentComments = await Comment.find({ 
    blog: { $in: userBlogs.map(blog => blog._id) }
  })
  .populate('user', 'username profile.avatar')
  .populate('blog', 'title')
  .sort({ createdAt: -1 })
  .limit(5);

  // Get popular blog
  const popularBlog = await Blog.findOne({ user: userId, status: 'published' })
    .sort({ likesCount: -1, views: -1 })
    .select('title likesCount views createdAt');

  // Get recent activity (comments + new blogs)
  const recentActivity = [
    ...recentComments.map(comment => ({
      type: 'comment',
      user: comment.user,
      message: `commented on "${comment.blog.title}"`,
      content: comment.content,
      time: comment.createdAt,
      blogId: comment.blog._id
    })),
    ...userBlogs.slice(0, 3).map(blog => ({
      type: 'blog',
      message: `published "${blog.title}"`,
      time: blog.createdAt,
      blogId: blog._id,
      status: blog.status
    }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

  // Calculate category distribution
  const categoryStats = {};
  userBlogs.forEach(blog => {
    if (blog.category) {
      categoryStats[blog.category] = (categoryStats[blog.category] || 0) + 1;
    }
  });

  // Update user stats
  await User.findByIdAndUpdate(userId, {
    $set: {
      'stats.blogCount': totalBlogs,
      'stats.totalViews': totalViews,
      'stats.totalLikes': totalLikes
    }
  });

  res.json({
    success: true,
    data: {
      overview: {
        totalBlogs,
        totalViews,
        totalLikes,
        publishedCount: publishedBlogs.length,
        draftCount: draftBlogs.length,
        scheduledCount: scheduledBlogs.length
      },
      recentActivity,
      popularBlog,
      recentBlogs: userBlogs.slice(0, 5).map(blog => ({
        _id: blog._id,
        title: blog.title,
        status: blog.status,
        likesCount: blog.likesCount,
        views: blog.views,
        createdAt: blog.createdAt,
        category: blog.category
      })),
      categoryStats,
      quickStats: {
        avgViews: totalBlogs > 0 ? Math.round(totalViews / totalBlogs) : 0,
        engagementRate: totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : 0
      }
    }
  });
});

// Get content calendar
const getContentCalendar = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const scheduledBlogs = await Blog.find({
    user: userId,
    status: 'scheduled',
    publishDate: { $gte: new Date() }
  })
  .select('title publishDate status category')
  .sort('publishDate');

  const draftBlogs = await Blog.find({
    user: userId,
    status: 'draft'
  })
  .select('title createdAt category')
  .sort('createdAt');

  res.json({
    success: true,
    scheduled: scheduledBlogs,
    drafts: draftBlogs
  });
});

// Get analytics data
const getAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { period = '30d' } = req.query; // 7d, 30d, 90d, 1y

  const userBlogs = await Blog.find({ 
    user: userId,
    status: 'published'
  }).select('views likesCount commentsCount createdAt');

  // Simple analytics - you can enhance this with more detailed time-based analysis
  const analytics = {
    totalViews: userBlogs.reduce((sum, blog) => sum + (blog.views || 0), 0),
    totalLikes: userBlogs.reduce((sum, blog) => sum + (blog.likesCount || 0), 0),
    totalComments: userBlogs.reduce((sum, blog) => sum + (blog.commentsCount || 0), 0),
    blogsCount: userBlogs.length,
    avgReadingTime: '5 min', // You can calculate this from blog content
    topPerforming: userBlogs.sort((a, b) => (b.views || 0) - (a.views || 0))[0] || null
  };

  res.json({
    success: true,
    analytics
  });
});

module.exports = {
  getDashboardData,
  getContentCalendar,
  getAnalytics
};