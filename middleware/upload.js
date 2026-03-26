const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { categorize } = require('../extractors');

const UPLOAD_BASE = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = categorize(file.mimetype, file.originalname);
    const dest = path.join(UPLOAD_BASE, category);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

module.exports = upload;
