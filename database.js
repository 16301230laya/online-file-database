const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const DB_PATH = path.join(dbDir, 'database.sqlite');

let db = null;

// Auto-save interval
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (db) {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    }
  }, 500);
}

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (parent_id) REFERENCES folders(id),
      UNIQUE(name, parent_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL UNIQUE,
      mime_type TEXT,
      category TEXT,
      size INTEGER,
      folder_id INTEGER,
      extracted_text TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      UNIQUE(file_id, tag)
    )
  `);

  save();
  return db;
}

function save() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// Helper: run query and return array of row objects
function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    console.error('Query error:', sql, err.message);
    return [];
  }
}

// Helper: run query and return first row
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length ? rows[0] : null;
}

// Helper: run statement (INSERT/UPDATE/DELETE)
function run(sql, params = []) {
  try {
    db.run(sql, params);
    scheduleSave();
    return { lastId: getLastInsertId(), changes: getChanges() };
  } catch (err) {
    console.error('Run error:', sql, err.message);
    throw err;
  }
}

function getLastInsertId() {
  return db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] || 0;
}

function getChanges() {
  return db.exec("SELECT changes() as c")[0]?.values[0]?.[0] || 0;
}

// Query functions
const queries = {
  insertFile({ originalName, storedName, mimeType, category, size, folderId, extractedText }) {
    return run(
      `INSERT INTO files (original_name, stored_name, mime_type, category, size, folder_id, extracted_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [originalName, storedName, mimeType, category, size, folderId, extractedText || '']
    );
  },

  getFileById(id) {
    return get('SELECT * FROM files WHERE id = ?', [id]);
  },

  listFiles({ folderId, category, limit = 50, offset = 0 }) {
    let sql = `SELECT f.*, GROUP_CONCAT(t.tag) as tags
               FROM files f LEFT JOIN tags t ON f.id = t.file_id WHERE 1=1`;
    const params = [];
    if (folderId !== null && folderId !== undefined) { sql += ' AND f.folder_id = ?'; params.push(folderId); }
    if (category) { sql += ' AND f.category = ?'; params.push(category); }
    sql += ' GROUP BY f.id ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return all(sql, params);
  },

  listFilesByFolder(folderId) {
    return all(
      `SELECT f.*, GROUP_CONCAT(t.tag) as tags
       FROM files f LEFT JOIN tags t ON f.id = t.file_id
       WHERE f.folder_id = ?
       GROUP BY f.id ORDER BY f.created_at DESC`,
      [folderId]
    );
  },

  listRootFiles() {
    return all(
      `SELECT f.*, GROUP_CONCAT(t.tag) as tags
       FROM files f LEFT JOIN tags t ON f.id = t.file_id
       WHERE f.folder_id IS NULL
       GROUP BY f.id ORDER BY f.created_at DESC`
    );
  },

  searchFiles(query) {
    // Search in filename and extracted text using LIKE (portable, no FTS5 needed)
    const terms = query.trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    let sql = `SELECT f.*, GROUP_CONCAT(t.tag) as tags FROM files f LEFT JOIN tags t ON f.id = t.file_id WHERE (`;
    const conditions = [];
    const params = [];
    for (const term of terms) {
      conditions.push('(f.original_name LIKE ? OR f.extracted_text LIKE ?)');
      params.push(`%${term}%`, `%${term}%`);
    }
    sql += conditions.join(' OR ') + ') GROUP BY f.id ORDER BY f.created_at DESC LIMIT 50';
    const results = all(sql, params);

    // Generate snippets
    return results.map(f => {
      let snippet = '';
      if (f.extracted_text) {
        const text = f.extracted_text;
        for (const term of terms) {
          const idx = text.toLowerCase().indexOf(term.toLowerCase());
          if (idx !== -1) {
            const start = Math.max(0, idx - 60);
            const end = Math.min(text.length, idx + term.length + 60);
            const before = start > 0 ? '...' : '';
            const after = end < text.length ? '...' : '';
            const raw = text.substring(start, end);
            // Wrap matching term in <mark>
            const highlighted = raw.replace(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
            snippet = before + highlighted + after;
            break;
          }
        }
      }
      return { ...f, snippet };
    });
  },

  getRecentFiles(limit = 20) {
    return all(
      `SELECT f.*, GROUP_CONCAT(t.tag) as tags
       FROM files f LEFT JOIN tags t ON f.id = t.file_id
       GROUP BY f.id ORDER BY f.created_at DESC LIMIT ?`,
      [limit]
    );
  },

  deleteFile(id) {
    // Delete tags first (CASCADE might not work without FK enforcement)
    run('DELETE FROM tags WHERE file_id = ?', [id]);
    return run('DELETE FROM files WHERE id = ?', [id]);
  },

  updateFile({ name, folderId, id }) {
    return run(
      `UPDATE files SET original_name = ?, folder_id = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
      [name, folderId, id]
    );
  },

  // Folders
  insertFolder({ name, parentId }) {
    return run('INSERT INTO folders (name, parent_id) VALUES (?, ?)', [name, parentId || null]);
  },

  renameFolder({ name, id }) {
    return run('UPDATE folders SET name = ? WHERE id = ?', [name, id]);
  },

  deleteFolder(id) {
    return run('DELETE FROM folders WHERE id = ?', [id]);
  },

  getFolderById(id) {
    return get('SELECT * FROM folders WHERE id = ?', [id]);
  },

  listFolders() {
    return all('SELECT * FROM folders ORDER BY name');
  },

  listSubfolders(parentId) {
    return all('SELECT * FROM folders WHERE parent_id = ? ORDER BY name', [parentId]);
  },

  countFolderContents(id) {
    const fileCount = get('SELECT COUNT(*) as count FROM files WHERE folder_id = ?', [id]);
    const folderCount = get('SELECT COUNT(*) as count FROM folders WHERE parent_id = ?', [id]);
    return {
      file_count: fileCount?.count || 0,
      folder_count: folderCount?.count || 0
    };
  },

  // Tags
  addTag({ fileId, tag }) {
    return run('INSERT OR IGNORE INTO tags (file_id, tag) VALUES (?, ?)', [fileId, tag]);
  },

  removeTag({ fileId, tag }) {
    return run('DELETE FROM tags WHERE file_id = ? AND tag = ?', [fileId, tag]);
  },

  getTagsForFile(fileId) {
    return all('SELECT tag FROM tags WHERE file_id = ?', [fileId]);
  },

  getAllTags() {
    return all('SELECT tag, COUNT(*) as count FROM tags GROUP BY tag ORDER BY count DESC');
  },

  getFilesByTag(tag) {
    return all(
      `SELECT f.*, GROUP_CONCAT(t2.tag) as tags
       FROM tags t JOIN files f ON f.id = t.file_id
       LEFT JOIN tags t2 ON f.id = t2.file_id
       WHERE t.tag = ?
       GROUP BY f.id ORDER BY f.created_at DESC`,
      [tag]
    );
  },

  // Stats
  getStats() {
    return get('SELECT COUNT(*) as total_files, COALESCE(SUM(size),0) as total_size FROM files') || { total_files: 0, total_size: 0 };
  },

  getCategoryCounts() {
    return all('SELECT category, COUNT(*) as count FROM files GROUP BY category ORDER BY count DESC');
  }
};

module.exports = { initDB, queries, save };
