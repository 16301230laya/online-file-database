const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDB } = require('./database');
const { authenticate, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directories exist (use persistent disk path on Render)
const UPLOAD_BASE = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const categories = ['documents', 'spreadsheets', 'images', 'pdfs', 'presentations', 'other'];
for (const cat of categories) {
  const dir = path.join(UPLOAD_BASE, cat);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Export for use in routes
app.locals.uploadBase = UPLOAD_BASE;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function start() {
  // Initialize database
  await initDB();

  // Auth routes (public - no auth needed)
  app.use('/api/auth', require('./routes/auth'));

  // Token via query param middleware (for image/preview/download that can't send headers)
  app.use('/api/files', (req, res, next) => {
    if (!req.headers.authorization && req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  });

  // Protected routes - require authentication
  // Files: viewers can read/download, only admin can upload/edit/delete
  app.use('/api/files', authenticate, require('./routes/files'));
  app.use('/api/folders', authenticate, require('./routes/folders'));
  app.use('/api/tags', authenticate, require('./routes/tags'));

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║   Online Database is running!        ║`);
    console.log(`  ║   http://localhost:${PORT}              ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
