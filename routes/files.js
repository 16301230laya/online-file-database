const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const upload = require('../middleware/upload');
const { queries } = require('../database');
const { extractText, categorize } = require('../extractors');
const { requireAdmin } = require('../middleware/auth');

const UPLOAD_BASE = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

// Upload files - ADMIN ONLY
router.post('/upload', requireAdmin, upload.array('files', 20), async (req, res) => {
  try {
    const folderId = req.body.folderId || null;
    const results = [];

    for (const file of req.files) {
      const category = categorize(file.mimetype, file.originalname);
      const filePath = file.path;

      // Extract text content for search
      const extractedText = await extractText(filePath, file.mimetype);

      const info = queries.insertFile({
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        category,
        size: file.size,
        folderId: folderId ? parseInt(folderId) : null,
        extractedText
      });

      const saved = queries.getFileById(info.lastId);
      results.push(saved);
    }

    res.json({ success: true, files: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List files - ALL USERS
router.get('/', (req, res) => {
  try {
    const { folderId, category, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let files;
    if (folderId === 'root') {
      files = queries.listRootFiles();
    } else if (folderId) {
      files = queries.listFilesByFolder(parseInt(folderId));
    } else if (category) {
      files = queries.listFiles({ folderId: null, category, limit: parseInt(limit), offset });
    } else {
      files = queries.listFiles({ folderId: null, category: null, limit: parseInt(limit), offset });
    }

    files = files.map(f => ({ ...f, tags: f.tags ? f.tags.split(',') : [] }));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search files - ALL USERS
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) return res.json([]);

    const files = queries.searchFiles(q);
    res.json(files.map(f => ({ ...f, tags: f.tags ? f.tags.split(',') : [] })));
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Recent files - ALL USERS
router.get('/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const files = queries.getRecentFiles(limit);
    res.json(files.map(f => ({ ...f, tags: f.tags ? f.tags.split(',') : [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats - ALL USERS
router.get('/stats', (req, res) => {
  try {
    const stats = queries.getStats();
    const categories = queries.getCategoryCounts();
    res.json({ ...stats, categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single file - ALL USERS
router.get('/:id', (req, res) => {
  try {
    const file = queries.getFileById(parseInt(req.params.id));
    if (!file) return res.status(404).json({ error: 'File not found' });
    const tags = queries.getTagsForFile(file.id).map(t => t.tag);
    res.json({ ...file, tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download file - ALL USERS
router.get('/:id/download', (req, res) => {
  try {
    const file = queries.getFileById(parseInt(req.params.id));
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(UPLOAD_BASE, file.category, file.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

    res.download(filePath, file.original_name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Preview file - ALL USERS
router.get('/:id/preview', (req, res) => {
  try {
    const file = queries.getFileById(parseInt(req.params.id));
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(UPLOAD_BASE, file.category, file.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update file (rename, move) - ADMIN ONLY
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const file = queries.getFileById(parseInt(req.params.id));
    if (!file) return res.status(404).json({ error: 'File not found' });

    const name = req.body.name || file.original_name;
    const folderId = req.body.folderId !== undefined ? req.body.folderId : file.folder_id;

    queries.updateFile({ name, folderId, id: parseInt(req.params.id) });
    const updated = queries.getFileById(parseInt(req.params.id));
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete file - ADMIN ONLY
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const file = queries.getFileById(parseInt(req.params.id));
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Delete physical file
    const filePath = path.join(UPLOAD_BASE, file.category, file.stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    queries.deleteFile(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
