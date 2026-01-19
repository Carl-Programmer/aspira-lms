const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/contents'), // 👈 matches your folder
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

router.post('/upload-content', upload.single('file'), (req, res) => {
  const { courseId } = req.body;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    courseId
  });
});

module.exports = router;
