// Main Application Controller
const App = {
  state: {
    view: 'recent',       // recent, all, category, folder, search, tag
    folderId: null,
    category: null,
    searchQuery: '',
    tag: null,
    folders: []
  },

  async init() {
    // Bind UI events
    this.bindEvents();
    // Load initial data
    await Promise.all([
      this.showRecent(),
      this.loadFolders(),
      this.loadTags(),
      this.loadStats()
    ]);
  },

  bindEvents() {
    // Upload button
    document.getElementById('uploadBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
      if (e.target.files.length) this.uploadFiles(e.target.files);
      e.target.value = '';
    });

    // Search
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const q = searchInput.value.trim();
        if (q.length >= 2) this.search(q);
        else if (q.length === 0) this.showRecent();
      }, 300);
    });

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
      if (e.key === 'Escape') {
        document.getElementById('modalOverlay').classList.remove('active');
        this.closeContextMenu();
      }
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        if (view === 'recent') this.showRecent();
        else if (view === 'all') this.showAll();
        else if (view === 'category') this.filterByCategory(item.dataset.category);
      });
    });

    // View mode toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        UI.viewMode = btn.dataset.viewMode;
        this.refreshView();
      });
    });

    // New folder button
    document.getElementById('newFolderBtn').addEventListener('click', () => this.createFolder());

    // Modal close
    document.getElementById('modalClose').addEventListener('click', () => {
      document.getElementById('modalOverlay').classList.remove('active');
    });
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modalOverlay')) {
        document.getElementById('modalOverlay').classList.remove('active');
      }
    });

    // Sidebar toggle (mobile)
    document.getElementById('menuToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });

    // Logo -> home
    document.getElementById('logoHome').addEventListener('click', () => this.showRecent());

    // Drag and drop
    this.initDragDrop();

    // Make nav items (Recent/All) drop targets to move files to root
    document.querySelectorAll('.nav-item[data-view="recent"], .nav-item[data-view="all"]').forEach(el => {
      el.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('application/x-file-id')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          el.classList.add('drag-over');
        }
      });
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
      el.addEventListener('drop', async (e) => {
        e.preventDefault();
        el.classList.remove('drag-over');
        const fileId = e.dataTransfer.getData('application/x-file-id');
        if (fileId) {
          await this.moveFileToRoot(parseInt(fileId));
        }
      });
    });

    // Close context menu on click outside
    document.addEventListener('click', () => this.closeContextMenu());
  },

  // Drag and Drop
  initDragDrop() {
    let dragCounter = 0;
    const overlay = document.getElementById('dropOverlay');

    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer.types.includes('Files')) overlay.classList.add('active');
    });

    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) { dragCounter = 0; overlay.classList.remove('active'); }
    });

    document.addEventListener('dragover', (e) => e.preventDefault());

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('active');
      if (e.dataTransfer.files.length) this.uploadFiles(e.dataTransfer.files);
    });
  },

  // Upload files
  async uploadFiles(fileList) {
    try {
      UI.showProgress(0, 'Preparing upload...');
      const result = await API.uploadFiles(fileList, this.state.folderId, (percent) => {
        UI.showProgress(percent);
      });
      UI.hideProgress();
      const count = result.files ? result.files.length : 0;
      UI.toast(`${count} file${count !== 1 ? 's' : ''} uploaded successfully!`, 'success');
      this.refreshView();
      this.loadStats();
      this.loadTags();
    } catch (err) {
      UI.hideProgress();
      UI.toast('Upload failed: ' + err.message, 'error');
    }
  },

  // Navigation methods
  setActiveNav(view, extra = null) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (view === 'recent') document.querySelector('[data-view="recent"]')?.classList.add('active');
    else if (view === 'all') document.querySelector('[data-view="all"]')?.classList.add('active');
    else if (view === 'category' && extra) document.querySelector(`[data-category="${extra}"]`)?.classList.add('active');
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  },

  async showRecent() {
    this.state = { ...this.state, view: 'recent', folderId: null, category: null, tag: null };
    this.setActiveNav('recent');
    UI.renderBreadcrumb([{ label: 'Recent Files' }], document.getElementById('breadcrumb'));

    try {
      const files = await API.getRecentFiles(30);
      UI.renderFiles(files, document.getElementById('fileArea'), {
        emptyMessage: 'No files yet',
        emptySubtext: 'Upload your first file using the button above or drag & drop'
      });
    } catch (err) {
      UI.toast('Failed to load files', 'error');
    }
  },

  async showAll() {
    this.state = { ...this.state, view: 'all', folderId: null, category: null, tag: null };
    this.setActiveNav('all');
    UI.renderBreadcrumb([{ label: 'All Files' }], document.getElementById('breadcrumb'));

    try {
      const files = await API.listFiles({ limit: 100 });
      UI.renderFiles(files, document.getElementById('fileArea'));
    } catch (err) {
      UI.toast('Failed to load files', 'error');
    }
  },

  async filterByCategory(category) {
    this.state = { ...this.state, view: 'category', category, folderId: null, tag: null };
    this.setActiveNav('category', category);
    const cat = UI.getCategoryInfo(category);
    UI.renderBreadcrumb([
      { label: 'Home', action: 'home' },
      { label: cat.label + 's' }
    ], document.getElementById('breadcrumb'));

    try {
      const files = await API.listFiles({ category, limit: 100 });
      UI.renderFiles(files, document.getElementById('fileArea'), {
        emptyMessage: `No ${cat.label.toLowerCase()}s`,
        emptySubtext: `Upload ${cat.label.toLowerCase()} files to see them here`
      });
    } catch (err) {
      UI.toast('Failed to load files', 'error');
    }
  },

  async navigateToFolder(folderId) {
    this.state = { ...this.state, view: 'folder', folderId, category: null, tag: null };
    this.setActiveNav('folder');

    // Build breadcrumb
    const folder = this.state.folders.find(f => f.id === folderId);
    const crumbs = [{ label: 'Home', action: 'home' }];
    if (folder) {
      // Build path
      const path = [];
      let current = folder;
      while (current) {
        path.unshift(current);
        current = this.state.folders.find(f => f.id === current.parent_id);
      }
      path.forEach((p, i) => {
        if (i === path.length - 1) crumbs.push({ label: p.name });
        else crumbs.push({ label: p.name, action: 'folder', id: p.id });
      });
    }
    UI.renderBreadcrumb(crumbs, document.getElementById('breadcrumb'));

    try {
      const data = await API.getFolderContents(folderId);
      UI.renderFiles(data.files, document.getElementById('fileArea'), {
        folders: data.folders,
        emptyMessage: 'Folder is empty',
        emptySubtext: 'Upload files or create subfolders'
      });
    } catch (err) {
      UI.toast('Failed to load folder', 'error');
    }

    // Update folder tree highlight
    document.querySelectorAll('.folder-item').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.folderId) === folderId);
    });
  },

  async search(query) {
    this.state = { ...this.state, view: 'search', searchQuery: query, folderId: null, category: null, tag: null };
    this.setActiveNav(null);
    UI.renderBreadcrumb([
      { label: 'Home', action: 'home' },
      { label: `Search: "${query}"` }
    ], document.getElementById('breadcrumb'));

    try {
      const files = await API.searchFiles(query);
      UI.renderFiles(files, document.getElementById('fileArea'), {
        emptyMessage: 'No results found',
        emptySubtext: `No files match "${query}". Try different keywords.`
      });
    } catch (err) {
      UI.toast('Search failed', 'error');
    }
  },

  async filterByTag(tag) {
    this.state = { ...this.state, view: 'tag', tag, folderId: null, category: null };
    this.setActiveNav(null);
    UI.renderBreadcrumb([
      { label: 'Home', action: 'home' },
      { label: `Tag: ${tag}` }
    ], document.getElementById('breadcrumb'));

    try {
      const files = await API.getFilesByTag(tag);
      UI.renderFiles(files, document.getElementById('fileArea'), {
        emptyMessage: 'No files with this tag',
        emptySubtext: 'Add this tag to files to see them here'
      });
    } catch (err) {
      UI.toast('Failed to load files', 'error');
    }
  },

  // Refresh current view
  async refreshView() {
    switch (this.state.view) {
      case 'recent': return this.showRecent();
      case 'all': return this.showAll();
      case 'category': return this.filterByCategory(this.state.category);
      case 'folder': return this.navigateToFolder(this.state.folderId);
      case 'search': return this.search(this.state.searchQuery);
      case 'tag': return this.filterByTag(this.state.tag);
    }
  },

  // File actions
  async showPreview(id) {
    try {
      const file = await API.getFile(id);
      UI.showPreviewModal(file);
    } catch (err) {
      UI.toast('Failed to load file details', 'error');
    }
  },

  async deleteFile(id) {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await API.deleteFile(id);
      UI.toast('File deleted', 'success');
      this.refreshView();
      this.loadStats();
    } catch (err) {
      UI.toast('Delete failed: ' + err.message, 'error');
    }
  },

  async moveFile(id) {
    const folders = this.state.folders;
    const optionsHtml = `<option value="">Root (no folder)</option>` +
      folders.map(f => `<option value="${f.id}">${UI.escapeHtml(f.name)}</option>`).join('');

    UI.showDialog('Move File', `
      <label>Select destination folder:</label>
      <select class="move-select" id="moveTarget">${optionsHtml}</select>
    `, async () => {
      const target = document.getElementById('moveTarget').value;
      try {
        await API.updateFile(id, { folderId: target ? parseInt(target) : null });
        UI.toast('File moved', 'success');
        this.refreshView();
      } catch (err) {
        UI.toast('Move failed: ' + err.message, 'error');
      }
    });
  },

  // Folder actions
  async createFolder() {
    UI.showDialog('New Folder', `
      <label>Folder name:</label>
      <input type="text" id="folderNameInput" placeholder="Enter folder name">
    `, async () => {
      const name = document.getElementById('folderNameInput').value.trim();
      if (!name) return UI.toast('Please enter a name', 'error');
      try {
        await API.createFolder(name, this.state.folderId || null);
        UI.toast(`Folder "${name}" created`, 'success');
        this.loadFolders();
        if (this.state.view === 'folder') this.refreshView();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  },

  async renameFolder(id) {
    const folder = this.state.folders.find(f => f.id === id);
    UI.showDialog('Rename Folder', `
      <label>New name:</label>
      <input type="text" id="folderNameInput" value="${UI.escapeHtml(folder?.name || '')}">
    `, async () => {
      const name = document.getElementById('folderNameInput').value.trim();
      if (!name) return UI.toast('Please enter a name', 'error');
      try {
        await API.renameFolder(id, name);
        UI.toast('Folder renamed', 'success');
        this.loadFolders();
        if (this.state.folderId === id) this.navigateToFolder(id);
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  },

  async deleteFolderAction(id) {
    if (!confirm('Delete this folder? It must be empty.')) return;
    try {
      await API.deleteFolder(id);
      UI.toast('Folder deleted', 'success');
      this.loadFolders();
      if (this.state.folderId === id) this.showRecent();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  },

  // Data loaders
  async loadFolders() {
    try {
      const folders = await API.listFolders();
      this.state.folders = folders;
      UI.renderFolderTree(folders, document.getElementById('folderTree'));
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  },

  async loadTags() {
    try {
      const tags = await API.getAllTags();
      UI.renderTags(tags, document.getElementById('tagCloud'));
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  },

  async loadStats() {
    try {
      const stats = await API.getFileStats();
      UI.renderStats(stats, document.getElementById('storageStats'));
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  },

  // Drag file directly to a folder
  async moveFileToFolder(fileId, folderId) {
    try {
      await API.updateFile(fileId, { folderId });
      const folder = this.state.folders.find(f => f.id === folderId);
      UI.toast(`File moved to "${folder ? folder.name : 'folder'}"`, 'success');
      this.refreshView();
    } catch (err) {
      UI.toast('Move failed: ' + err.message, 'error');
    }
  },

  // Drag file to root (no folder)
  async moveFileToRoot(fileId) {
    try {
      await API.updateFile(fileId, { folderId: null });
      UI.toast('File moved to root', 'success');
      this.refreshView();
    } catch (err) {
      UI.toast('Move failed: ' + err.message, 'error');
    }
  },

  // Context menu
  closeContextMenu() {
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
