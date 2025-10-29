const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "username is required"],
  },
  email: {
    type: String,
    required: [true, "email is required"],
  },
  password: {
    type: String,
    required: [true, "password is required"],
  },
  // KEEP existing blogs field
  blogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog'
  }],
  
  // ENHANCED PROFILE SECTION
  profile: {
    displayName: {
      type: String,
      trim: true
    },
    bio: {
      type: String,
      maxlength: 500
    },
    avatar: {
      type: String,
      default: ''
    },
    website: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    social: {
      twitter: String,
      linkedin: String,
      github: String
    },
    // NEW: Join date for profile display
    joinDate: {
      type: Date,
      default: Date.now
    }
  },
  
  // ENHANCED STATS SECTION
  stats: {
    blogCount: {
      type: Number,
      default: 0
    },
    totalLikes: {
      type: Number,
      default: 0
    },
    totalComments: {
      type: Number,
      default: 0
    },
    // NEW STATS FIELDS
    totalViews: {
      type: Number,
      default: 0
    },
    followersCount: {
      type: Number,
      default: 0
    },
    followingCount: {
      type: Number,
      default: 0
    },
    // For analytics
    mostPopularCategory: {
      type: String,
      default: ''
    },
    monthlyViews: {
      type: Number,
      default: 0
    }
  },
  
  // ENHANCED PREFERENCES
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    // NEW PREFERENCES
    publicProfile: {
      type: Boolean,
      default: true
    },
    showEmail: {
      type: Boolean,
      default: false
    },
    allowComments: {
      type: Boolean,
      default: true
    }
  },
  
  // KEEP existing arrays
  likedBlogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog'
  }],
  favoriteBlogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog'
  }],
  
  // NEW FIELDS FOR DASHBOARD FEATURES
  achievements: [{
    name: String,
    description: String,
    icon: String,
    earnedAt: Date
  }],
  
  readingList: [{
    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Blog'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // For content calendar
  scheduledBlogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog'
  }],
  
  // For follower system (future feature)
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
  
}, { timestamps: true });

// Virtual for formatted join date
userSchema.virtual('formattedJoinDate').get(function() {
  return this.profile.joinDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long'
  });
});

// Method to update stats
userSchema.methods.updateStats = async function() {
  const Blog = mongoose.model('Blog');
  const userBlogs = await Blog.find({ author: this._id });
  
  this.stats.blogCount = userBlogs.length;
  this.stats.totalLikes = userBlogs.reduce((sum, blog) => sum + (blog.likesCount || 0), 0);
  this.stats.totalViews = userBlogs.reduce((sum, blog) => sum + (blog.views || 0), 0);
  
  // Calculate most popular category
  const categoryCount = {};
  userBlogs.forEach(blog => {
    categoryCount[blog.category] = (categoryCount[blog.category] || 0) + 1;
  });
  
  if (Object.keys(categoryCount).length > 0) {
    this.stats.mostPopularCategory = Object.keys(categoryCount).reduce((a, b) => 
      categoryCount[a] > categoryCount[b] ? a : b
    );
  }
  
  await this.save();
};

module.exports = mongoose.model("User", userSchema);