const express = require('express');
const Blog = require('../models/blogModel');

const router = express.Router();

// @route   GET /sitemap.xml
// @desc    Generate sitemap for SEO
// @access  Public
router.get('/sitemap.xml', async (req, res) => {
  try {
    const blogs = await Blog.find({}).select('slug updatedAt').sort({ updatedAt: -1 });
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${process.env.CLIENT_URL || 'http://localhost:3000'}</loc>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${process.env.CLIENT_URL || 'http://localhost:3000'}/blogs</loc>
    <priority>0.8</priority>
  </url>`;

    blogs.forEach(blog => {
      sitemap += `
  <url>
    <loc>${process.env.CLIENT_URL || 'http://localhost:3000'}/blog-details/${blog.slug || blog._id}</loc>
    <lastmod>${blog.updatedAt.toISOString().split('T')[0]}</lastmod>
    <priority>0.6</priority>
  </url>`;
    });

    sitemap += '\n</urlset>';

    res.set('Content-Type', 'text/xml');
    res.send(sitemap);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating sitemap');
  }
});

// @route   GET /robots.txt
// @desc    Robots.txt for SEO
// @access  Public
router.get('/robots.txt', (req, res) => {
  const robots = `User-agent: *
Allow: /
Sitemap: ${process.env.CLIENT_URL || 'http://localhost:3000'}/sitemap.xml`;

  res.set('Content-Type', 'text/plain');
  res.send(robots);
});

module.exports = router;