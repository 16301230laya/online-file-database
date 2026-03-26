const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const { requireAdmin } = require('../middleware/auth');

// List all folders - ALL USERS
router.get('/', (req, res) => {
  try {
    const folders = queries.listFolders();
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get folder contents - ALL USERS
router.get('/:id/contents', (req, res) => {
  try {
    const folderId = parseInt(req.params.id);
    const subfolders = queries.listSubfolders(folderId);
    const files = queries.listFilesByFolder(folderId);
    res.json({
      folders: subfolders,
      files: files.map(f => ({ ...f, tags: f.tags ? f.tags.split(',') : [] }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create folder - ADMIN ONLY
router.post('/', requireAdmin, (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Folder name is required' });

    const info = queries.insertFolder({
      name: name.trim(),
      parentId: parentId || null
    });
    const folder = queries.getFolderById(info.lastId);
    res.json(folder);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A folder with this name already exists here' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Rename folder - ADMIN ONLY
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });

    queries.renameFolder({ name: name.trim(), id: parseInt(req.params.id) });
    const folder = queries.getFolderById(parseInt(req.params.id));
    res.json(folder);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A folder with this name already exists here' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete folder - ADMIN ONLY
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const counts = queries.countFolderContents(parseInt(req.params.id));
    if (counts.file_count > 0 || counts.folder_count > 0) {
      return res.status(400).json({
        error: `Folder is not empty (${counts.file_count} files, ${counts.folder_count} subfolders). Move or delete contents first.`
      });
    }

    queries.deleteFolder(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
