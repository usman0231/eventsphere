const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// Memory storage — the buffer is streamed straight to Cloudinary (Vercel's disk is ephemeral).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'));
    }
    cb(null, true);
  },
});

router.post('/image', protect, authorize('admin', 'organizer', 'exhibitor'), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ success: false, message: 'Image storage is not configured' });
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: 'eventsphere', resource_type: 'image' },
      (error, result) => {
        if (error || !result) {
          console.error('Cloudinary upload error:', error && error.message);
          return res.status(500).json({ success: false, message: 'Upload failed' });
        }
        res.json({
          success: true,
          data: { url: result.secure_url, filename: result.public_id, size: result.bytes },
        });
      }
    );
    stream.end(req.file.buffer);
  });
});

module.exports = router;
