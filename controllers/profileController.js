const User = require('../models/userModel');
const asyncHandler = require('express-async-handler');
const cloudinary = require('../config/cloudinary');

// Get user profile
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('-password')
    .populate('blogs', 'title likesCount views createdAt category');
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Calculate stats if needed
  if (user.stats.blogCount === 0 && user.blogs.length > 0) {
    await user.updateStats();
  }
  
  res.json({
    success: true,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      profile: user.profile,
      stats: {
        totalBlogs: user.stats.blogCount || user.blogs.length,
        totalLikes: user.stats.totalLikes || 0,
        totalComments: user.stats.totalComments || 0,
        totalViews: user.stats.totalViews || 0
      },
      preferences: user.preferences,
      achievements: user.achievements,
      joinDate: user.formattedJoinDate,
      blogs: user.blogs
    }
  });
});

// Update user profile
const updateUserProfile = asyncHandler(async (req, res) => {
  const {
    displayName,
    bio,
    location,
    website,
    social,
    preferences,
    avatar
  } = req.body;

  console.log('Received profile update data:', req.body);

  const user = await User.findById(req.user.id);

  if (user) {
    // Update profile fields
    if (displayName !== undefined) user.profile.displayName = displayName;
    if (bio !== undefined) user.profile.bio = bio;
    if (location !== undefined) user.profile.location = location;
    if (website !== undefined) user.profile.website = website;
    if (avatar !== undefined) user.profile.avatar = avatar;
    
    // Update social media if provided
    if (social) {
      if (social.twitter !== undefined) user.profile.social.twitter = social.twitter;
      if (social.linkedin !== undefined) user.profile.social.linkedin = social.linkedin;
      if (social.github !== undefined) user.profile.social.github = social.github;
    }
    
    // Update preferences if provided
    if (preferences) {
      if (preferences.emailNotifications !== undefined) 
        user.preferences.emailNotifications = preferences.emailNotifications;
      if (preferences.publicProfile !== undefined) 
        user.preferences.publicProfile = preferences.publicProfile;
      if (preferences.showEmail !== undefined) 
        user.preferences.showEmail = preferences.showEmail;
    }

    const updatedUser = await user.save();
    
    console.log('Successfully updated profile:', {
      displayName: updatedUser.profile.displayName,
      bio: updatedUser.profile.bio,
      location: updatedUser.profile.location,
      avatar: updatedUser.profile.avatar
    });
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        profile: updatedUser.profile,
        preferences: updatedUser.preferences
      }
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// Upload profile picture with Cloudinary - FIXED FOR CLOUDINARY STORAGE
const uploadProfilePicture = asyncHandler(async (req, res) => {
  try {
    console.log('=== PROFILE PICTURE UPLOAD START ===');
    
    if (!req.file) {
      console.log('No file received in request');
      res.status(400);
      throw new Error('No file uploaded');
    }

    console.log('File details from Cloudinary:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      cloudinaryUrl: req.file.path // Cloudinary provides the URL directly
    });

    const user = await User.findById(req.user.id);
    
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // With CloudinaryStorage, the file is already uploaded to Cloudinary
    // and the URL is available in req.file.path
    const avatarUrl = req.file.path;

    if (!avatarUrl) {
      res.status(500);
      throw new Error('Failed to get image URL from Cloudinary');
    }

    console.log('✅ Cloudinary upload successful:', avatarUrl);

    // Update user profile with the Cloudinary URL
    user.profile.avatar = avatarUrl;
    await user.save();
    
    console.log('✅ User profile updated with new avatar');
    
    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      avatar: user.profile.avatar
    });
    
    console.log('=== PROFILE PICTURE UPLOAD COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Profile picture upload error:', error);
    res.status(500);
    throw new Error('Profile picture upload failed: ' + error.message);
  }
});

// Get public profile (for other users to view)
const getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select('username profile stats preferences createdAt')
    .populate('blogs', 'title likesCount views createdAt category status');
  
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  
  // Only return published blogs for public view
  const publicBlogs = user.blogs.filter(blog => blog.status === 'published');
  
  res.json({
    success: true,
    user: {
      _id: user._id,
      username: user.username,
      profile: user.profile,
      stats: {
        totalBlogs: publicBlogs.length,
        totalLikes: user.stats.totalLikes || 0,
        totalComments: user.stats.totalComments || 0,
        totalViews: user.stats.totalViews || 0
      },
      joinDate: user.formattedJoinDate,
      blogs: publicBlogs
    }
  });
});

module.exports = {
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  getPublicProfile
};