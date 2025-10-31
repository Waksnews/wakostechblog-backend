const mongoose = require("mongoose");
const blogModel = require("../models/blogModel");
const userModel = require("../models/userModel");
const path = require("path");
const fs = require("fs");

// GET ALL BLOGS
exports.getAllBlogsController = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;
    
    let query = {};
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const blogs = await blogModel.find(query)
      .populate("user", "username email profile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await blogModel.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Format dates and ensure image URLs are correct
    const formattedBlogs = blogs.map(blog => ({
      ...blog.toObject(),
      formattedDate: formatDate(blog.createdAt),
      readingTime: calculateReadingTime(blog.description),
      image: getFullImageUrl(blog.image)
    }));

    if (!blogs || blogs.length === 0) {
      return res.status(200).send({
        success: true,
        message: "No Blogs Found",
        blogs: []
      });
    }
    
    return res.status(200).send({
      success: true,
      BlogCount: blogs.length,
      totalPages,
      currentPage: page,
      total,
      message: "All Blogs List",
      blogs: formattedBlogs,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Error While Getting Blogs",
      error: error.message,
    });
  }
};

// CREATE BLOG
exports.createBlogController = async (req, res) => {
  try {
    const { title, description, category, excerpt } = req.body;
    
    // Get user ID from authenticated user
    const userId = req.user.id || req.user._id;

    // Check if user is authenticated
    if (!userId) {
      return res.status(401).send({
        success: false,
        message: "User not authenticated. Please login first.",
      });
    }

    // Validation
    if (!title || !description) {
      return res.status(400).send({
        success: false,
        message: "Title and description are required",
      });
    }

    // Find user
    const existingUser = await userModel.findById(userId);
    if (!existingUser) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Handle image - check both file upload and base64/image URL
    let imageUrl = "";
    
    if (req.file) {
      // File upload via multer - use relative path
      imageUrl = `/uploads/${req.file.filename}`;
      console.log("File upload detected:", imageUrl);
    } else if (req.body.image) {
      // Base64 string or image URL from frontend
      imageUrl = req.body.image;
      console.log("Image from body detected");
    } else {
      return res.status(400).send({
        success: false,
        message: "Image is required",
      });
    }

    // Calculate reading time
    const readingTime = calculateReadingTime(description);

    // Create new blog
    const newBlog = new blogModel({ 
      title, 
      description, 
      image: imageUrl,
      user: userId,
      category: category || 'technology',
      excerpt: excerpt || description.substring(0, 150) + '...',
      readingTime: readingTime
    });

    console.log("Creating blog with image:", imageUrl);

    // Use transaction for data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await newBlog.save({ session });
      
      // Initialize blogs array if it doesn't exist
      if (!existingUser.blogs) {
        existingUser.blogs = [];
      }
      
      existingUser.blogs.push(newBlog._id);
      
      // Update user stats
      existingUser.stats.blogCount = (existingUser.stats.blogCount || 0) + 1;
      
      await existingUser.save({ session });
      await session.commitTransaction();

      // Populate user info for response
      await newBlog.populate("user", "username email profile");

      console.log("Blog created successfully with ID:", newBlog._id);

      // Format the response with proper date and image URL
      const formattedBlog = {
        ...newBlog.toObject(),
        formattedDate: formatDate(newBlog.createdAt),
        image: getFullImageUrl(newBlog.image),
        readingTime: newBlog.readingTime
      };

      return res.status(201).send({
        success: true,
        message: "Blog Created Successfully!",
        blog: formattedBlog,
      });
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.log("Error in createBlogController:", error);
    return res.status(500).send({
      success: false,
      message: "Error While Creating Blog",
      error: error.message,
    });
  }
};

// UPDATE BLOG - FIXED EDIT FUNCTIONALITY
exports.updateBlogController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, excerpt, image: existingImage } = req.body;
    
    console.log("Update request received for blog:", id);
    console.log("Request body:", { title, description, category, excerpt });
    console.log("File received:", req.file);

    // Check if user is authenticated
    if (!req.user || (!req.user.id && !req.user._id)) {
      return res.status(401).send({
        success: false,
        message: "User not authenticated",
      });
    }

    // Find the blog first to check ownership
    const existingBlog = await blogModel.findById(id);
    if (!existingBlog) {
      return res.status(404).send({
        success: false,
        message: "Blog not found",
      });
    }

    // Check if user owns the blog
    const userId = req.user.id || req.user._id;
    if (existingBlog.user.toString() !== userId.toString()) {
      return res.status(403).send({
        success: false,
        message: "Not authorized to update this blog",
      });
    }

    // Prepare update data
    const updateData = {
      title: title || existingBlog.title,
      description: description || existingBlog.description,
      category: category || existingBlog.category,
      excerpt: excerpt || existingBlog.excerpt,
      updatedAt: new Date()
    };

    // Handle image update
    if (req.file) {
      // New file uploaded
      updateData.image = `/uploads/${req.file.filename}`;
      console.log("New image uploaded:", updateData.image);
      
      // Optional: Delete old image file if it exists and is not the default
      if (existingBlog.image && !existingBlog.image.startsWith('data:image')) {
        const oldImagePath = path.join(__dirname, '..', existingBlog.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log("Old image deleted:", oldImagePath);
        }
      }
    } else if (existingImage) {
      // Image from body (could be base64 or URL)
      updateData.image = existingImage;
      console.log("Image updated from body");
    }
    // If no image provided, keep the existing image

    // Update reading time if description changed
    if (description) {
      updateData.readingTime = calculateReadingTime(description);
    }

    // Update the blog
    const updatedBlog = await blogModel.findByIdAndUpdate(
      id, 
      updateData, 
      { 
        new: true, 
        runValidators: true 
      }
    ).populate("user", "username email profile");

    if (!updatedBlog) {
      return res.status(404).send({
        success: false,
        message: "Blog not found after update",
      });
    }

    // Format the response
    const formattedBlog = {
      ...updatedBlog.toObject(),
      formattedDate: formatDate(updatedBlog.createdAt),
      image: getFullImageUrl(updatedBlog.image),
      readingTime: updatedBlog.readingTime || calculateReadingTime(updatedBlog.description)
    };

    console.log("Blog updated successfully:", updatedBlog._id);

    return res.status(200).send({
      success: true,
      message: "Blog Updated Successfully!",
      blog: formattedBlog,
    });
  } catch (error) {
    console.log("Error in updateBlogController:", error);
    return res.status(400).send({
      success: false,
      message: "Error While Updating Blog",
      error: error.message,
    });
  }
};

// GET SINGLE BLOG
exports.getBlogByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await blogModel.findById(id)
      .populate("user", "username email profile")
      .populate("likes", "username profile")
      .populate("favorites", "username profile");

    if (!blog) {
      return res.status(404).send({
        success: false,
        message: "Blog not found",
      });
    }

    // Format the response
    const formattedBlog = {
      ...blog.toObject(),
      formattedDate: formatDate(blog.createdAt),
      image: getFullImageUrl(blog.image),
      readingTime: blog.readingTime || calculateReadingTime(blog.description)
    };
    
    return res.status(200).send({
      success: true,
      message: "Blog fetched successfully",
      blog: formattedBlog,
    });
  } catch (error) {
    console.log(error);
    return res.status(400).send({
      success: false,
      message: "Error while getting blog",
      error: error.message,
    });
  }
};

// DELETE BLOG
exports.deleteBlogController = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || (!req.user.id && !req.user._id)) {
      return res.status(401).send({
        success: false,
        message: "User not authenticated",
      });
    }

    const blog = await blogModel.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).send({ 
        success: false, 
        message: "Blog not found" 
      });
    }

    // Check if user owns the blog
    if (blog.user.toString() !== (req.user.id || req.user._id).toString()) {
      return res.status(403).send({
        success: false,
        message: "Not authorized to delete this blog",
      });
    }

    // Delete associated image file if it exists
    if (blog.image && !blog.image.startsWith('data:image')) {
      const imagePath = path.join(__dirname, '..', blog.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log("Blog image deleted:", imagePath);
      }
    }
    
    // Remove blog from user's blogs array
    await userModel.findByIdAndUpdate(
      blog.user,
      { 
        $pull: { blogs: blog._id },
        $inc: { "stats.blogCount": -1 }
      }
    );
    
    await blogModel.findByIdAndDelete(req.params.id);
    
    return res.status(200).send({
      success: true,
      message: "Blog Deleted Successfully!",
    });
  } catch (error) {
    console.log(error);
    return res.status(400).send({
      success: false,
      message: "Error While Deleting Blog",
      error: error.message,
    });
  }
};

// GET CURRENT USER BLOGS
exports.userBlogControlller = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || (!req.user.id && !req.user._id)) {
      return res.status(401).send({
        success: false,
        message: "User not authenticated. Please login first.",
      });
    }

    const userId = req.user.id || req.user._id;

    const userBlog = await userModel.findById(userId)
      .populate({
        path: "blogs",
        options: { sort: { createdAt: -1 } },
        populate: {
          path: "user",
          select: "username email profile"
        }
      })
      .select("username email profile stats blogs");
      
    if (!userBlog) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Format blogs with proper dates and image URLs
    const formattedBlogs = userBlog.blogs.map(blog => ({
      ...blog.toObject(),
      formattedDate: formatDate(blog.createdAt),
      image: getFullImageUrl(blog.image),
      readingTime: blog.readingTime || calculateReadingTime(blog.description)
    }));
    
    return res.status(200).send({
      success: true,
      message: "User Blogs Fetched Successfully",
      userBlog: {
        _id: userBlog._id,
        username: userBlog.username,
        email: userBlog.email,
        profile: userBlog.profile,
        stats: userBlog.stats,
        blogs: formattedBlogs || []
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(400).send({
      success: false,
      message: "Error in fetching user blogs",
      error: error.message,
    });
  }
};

// GET USER BLOGS BY ID (PUBLIC)
exports.getUserBlogsByIdController = async (req, res) => {
  try {
    const { id } = req.params;

    const userBlog = await userModel.findById(id)
      .populate({
        path: "blogs",
        options: { sort: { createdAt: -1 } },
        populate: {
          path: "user",
          select: "username email profile"
        }
      })
      .select("username email profile stats blogs");
      
    if (!userBlog) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Format blogs with proper dates and image URLs
    const formattedBlogs = userBlog.blogs.map(blog => ({
      ...blog.toObject(),
      formattedDate: formatDate(blog.createdAt),
      image: getFullImageUrl(blog.image),
      readingTime: blog.readingTime || calculateReadingTime(blog.description)
    }));
    
    return res.status(200).send({
      success: true,
      message: "User Blogs Fetched Successfully",
      userBlog: {
        _id: userBlog._id,
        username: userBlog.username,
        email: userBlog.email,
        profile: userBlog.profile,
        stats: userBlog.stats,
        blogs: formattedBlogs || []
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(400).send({
      success: false,
      message: "Error in fetching user blogs",
      error: error.message,
    });
  }
};

// LIKE/UNLIKE BLOG
exports.likeBlogController = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || (!req.user.id && !req.user._id)) {
      return res.status(401).send({
        success: false,
        message: "User not authenticated",
      });
    }

    const blogId = req.params.id;
    const userId = req.user.id || req.user._id;

    const blog = await blogModel.findById(blogId);
    if (!blog) {
      return res.status(404).send({
        success: false,
        message: 'Blog not found'
      });
    }

    const isLiked = blog.likes.includes(userId);
    
    if (isLiked) {
      // Unlike
      blog.likes.pull(userId);
      blog.likesCount = Math.max(0, blog.likesCount - 1);
      
      // Remove from user's liked blogs
      await userModel.findByIdAndUpdate(userId, {
        $pull: { likedBlogs: blogId }
      });
    } else {
      // Like
      blog.likes.push(userId);
      blog.likesCount += 1;
      
      // Add to user's liked blogs
      await userModel.findByIdAndUpdate(userId, {
        $addToSet: { likedBlogs: blogId }
      });
    }

    await blog.save();

    res.status(200).send({
      success: true,
      message: isLiked ? 'Blog unliked successfully' : 'Blog liked successfully',
      likesCount: blog.likesCount,
      isLiked: !isLiked
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Error while processing like',
      error: error.message
    });
  }
};

// ADD/REMOVE FAVORITE
exports.favoriteBlogController = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || (!req.user.id && !req.user._id)) {
      return res.status(401).send({
        success: false,
        message: "User not authenticated",
      });
    }

    const blogId = req.params.id;
    const userId = req.user.id || req.user._id;

    const blog = await blogModel.findById(blogId);
    const user = await userModel.findById(userId);

    if (!blog) {
      return res.status(404).send({
        success: false,
        message: 'Blog not found'
      });
    }

    if (!user) {
      return res.status(404).send({
        success: false,
        message: 'User not found'
      });
    }

    const isFavorited = blog.favorites.includes(userId);
    
    if (isFavorited) {
      // Remove from favorites
      blog.favorites.pull(userId);
      blog.favoritesCount = Math.max(0, blog.favoritesCount - 1);
      user.favoriteBlogs.pull(blogId);
    } else {
      // Add to favorites
      blog.favorites.push(userId);
      blog.favoritesCount += 1;
      user.favoriteBlogs.push(blogId);
    }

    await blog.save();
    await user.save();

    res.status(200).send({
      success: true,
      message: isFavorited ? 'Removed from favorites' : 'Added to favorites',
      favoritesCount: blog.favoritesCount,
      isFavorited: !isFavorited
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Error while processing favorite',
      error: error.message
    });
  }
};

// GET POPULAR BLOGS
exports.getPopularBlogsController = async (req, res) => {
  try {
    const blogs = await blogModel.find({})
      .populate("user", "username email profile")
      .sort({ likesCount: -1, favoritesCount: -1, createdAt: -1 })
      .limit(6);

    // Format blogs with proper dates and image URLs
    const formattedBlogs = blogs.map(blog => ({
      ...blog.toObject(),
      formattedDate: formatDate(blog.createdAt),
      image: getFullImageUrl(blog.image),
      readingTime: blog.readingTime || calculateReadingTime(blog.description)
    }));

    return res.status(200).send({
      success: true,
      message: "Popular Blogs Retrieved Successfully",
      blogs: formattedBlogs,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Error While Getting Popular Blogs",
      error: error.message,
    });
  }
};

// GET BLOGS BY CATEGORY
exports.getBlogsByCategoryController = async (req, res) => {
  try {
    const { category } = req.params;
    
    // Validate category
    const validCategories = ['technology', 'science', 'business', 'health', 'entertainment', 'sports', 'lifestyle'];
    if (!validCategories.includes(category)) {
      return res.status(400).send({
        success: false,
        message: "Invalid category",
        validCategories
      });
    }

    const blogs = await blogModel.find({ category })
      .populate("user", "username email profile")
      .sort({ createdAt: -1 });

    // Format blogs with proper dates and image URLs
    const formattedBlogs = blogs.map(blog => ({
      ...blog.toObject(),
      formattedDate: formatDate(blog.createdAt),
      image: getFullImageUrl(blog.image),
      readingTime: blog.readingTime || calculateReadingTime(blog.description)
    }));

    return res.status(200).send({
      success: true,
      message: `Blogs in ${category} category`,
      count: blogs.length,
      blogs: formattedBlogs,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Error While Getting Blogs by Category",
      error: error.message,
    });
  }
};

// GET USER'S BLOG STATISTICS
exports.getUserBlogStatsController = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || (!req.user.id && !req.user._id)) {
      return res.status(401).send({
        success: false,
        message: "User not authenticated",
      });
    }

    const userId = req.user.id || req.user._id;
    
    const user = await userModel.findById(userId)
      .populate('blogs')
      .select('stats username profile');
    
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found"
      });
    }

    // Calculate additional stats
    const totalLikes = user.blogs.reduce((sum, blog) => sum + (blog.likesCount || 0), 0);
    const totalFavorites = user.blogs.reduce((sum, blog) => sum + (blog.favoritesCount || 0), 0);
    const totalComments = user.blogs.reduce((sum, blog) => sum + (blog.commentCount || 0), 0);

    const stats = {
      blogCount: user.stats.blogCount || 0,
      totalLikes,
      totalFavorites,
      totalComments,
      popularBlogs: user.blogs
        .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
        .slice(0, 3)
    };

    return res.status(200).send({
      success: true,
      message: "User blog statistics retrieved successfully",
      stats
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      success: false,
      message: "Error while getting user blog statistics",
      error: error.message
    });
  }
};

// UPLOAD EDITOR IMAGE
exports.uploadEditorImageController = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || (!req.user.id && !req.user._id)) {
      return res.status(401).send({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!req.file) {
      return res.status(400).send({
        success: false,
        message: "No image file provided"
      });
    }

    // Construct the full URL for the uploaded image
    const imageUrl = `/uploads/${req.file.filename}`;
    const fullImageUrl = getFullImageUrl(imageUrl);

    console.log("Editor image uploaded successfully:", imageUrl);

    res.status(200).send({
      success: true,
      message: "Image uploaded successfully",
      imageUrl: fullImageUrl
    });

  } catch (error) {
    console.error('Editor image upload error:', error);
    res.status(500).send({
      success: false,
      message: "Error uploading image",
      error: error.message
    });
  }
};

// HELPER FUNCTIONS

// Format date to readable string
function formatDate(date) {
  if (!date) return 'Invalid Date';
  
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

// Calculate reading time
function calculateReadingTime(description) {
  if (!description) return 1;
  
  const wordsPerMinute = 200;
  const words = description.split(/\s+/).length;
  const readingTime = Math.ceil(words / wordsPerMinute);
  return Math.max(1, readingTime); // At least 1 min
}

// Ensure image URL is full URL - FIXED FOR PRODUCTION
function getFullImageUrl(imagePath) {
  if (!imagePath) return '';
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // If it's a base64 image, return as is
  if (imagePath.startsWith('data:image')) {
    return imagePath;
  }
  
  // For production, return full backend URL
  if (process.env.NODE_ENV === 'production') {
    return `https://wakostechblog-backend.onrender.com${imagePath}`;
  }
  
  // For development, use relative path (localhost)
  if (imagePath.startsWith('/uploads')) {
    return `http://localhost:5000${imagePath}`;
  }
  
  // If it's just a filename, prepend /uploads/
  if (!imagePath.startsWith('/')) {
    return `http://localhost:5000/uploads/${imagePath}`;
  }
  
  return imagePath;
}