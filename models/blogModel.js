const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "title is required"],
  },
  description: {
    type: String,
    required: [true, "description is required"],
  },
  image: {
    type: String,
    required: [true, "image is required"],
  },
  user: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: [true, "user id is required"], // Fixed typo: require -> required
  },
  category: {
    type: String,
    enum: ['technology', 'science', 'business', 'health', 'entertainment', 'sports', 'lifestyle'],
    default: 'technology'
  },
  excerpt: {
    type: String,
    maxlength: 200
  },
  likes: [{
    type: mongoose.Types.ObjectId,
    ref: "User"
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  favorites: [{
    type: mongoose.Types.ObjectId,
    ref: "User"
  }],
  favoritesCount: {
    type: Number,
    default: 0
  },
  comments: [{
    type: mongoose.Types.ObjectId,
    ref: "Comment"
  }],
  commentCount: {
    type: Number,
    default: 0
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    slug: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  readingTime: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Generate slug and reading time before saving
blogSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);
  }
  
  // Calculate reading time
  if (this.isModified('description')) {
    const wordsPerMinute = 200;
    const words = this.description.split(/\s+/).length;
    this.readingTime = Math.ceil(words / wordsPerMinute);
    
    // Generate excerpt if not provided
    if (!this.excerpt) {
      this.excerpt = this.description.substring(0, 150) + '...';
    }
  }
  
  next();
});

module.exports = mongoose.model("Blog", blogSchema);