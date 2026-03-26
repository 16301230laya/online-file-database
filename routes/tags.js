const express = require('express');
const router = express.Router();
const { queries } = require('../database');

// Get all tags
router.get('/', (req, res) => {
  try {
    const tags = queries.getAllTags();
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get files by tag
router.get('/:tag/files', (req, res) => {
  try {
    const files = queries.getFilesByTag(req.params.tag);
    res.json(files.map(f => ({ ...f, tags: f.tags ? f.tags.split(',') : [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add tag to file
router.post('/file/:fileId', (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag || !tag.trim()) return res.status(400).json({ error: 'Tag is required' });

    queries.addTag({ fileId: parseInt(req.params.fileId), tag: tag.trim().toLowerCase() });
    const tags = queries.getTagsForFile(parseInt(req.params.fileId)).map(t => t.tag);
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove tag from file
router.delete('/file/:fileId/:tag', (req, res) => {
  try {
    queries.removeTag({ fileId: parseInt(req.params.fileId), tag: req.params.tag });
    const tags = queries.getTagsForFile(parseInt(req.params.fileId)).map(t => t.tag);
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
