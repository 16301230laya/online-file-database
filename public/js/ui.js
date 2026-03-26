// UI Rendering Functions
const UI = {
  viewMode: 'grid',

  // Format file size
  formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  },

  // Format date
  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  },

  // Get category display info
  getCategoryInfo(category) {
    const map = {
      documents:     { icon: 'W', label: 'Document', class: 'documents' },
      spreadsheets:  { icon: 'X', label: 'Spreadsheet', class: 'spreadsheets' },
      pdfs:          { icon: 'P', label: 'PDF', class: 'pdfs' },
      presentations: { icon: 'S', label: 'Slides', class: 'presentations' },
      images:        { icon: 'I', label: 'Image', class: 'images' },
      other:         { icon: 'O', label: 'File', class: 'other' }
    };
    return map[category] || map.other;
  },

  // Render file grid
  renderFiles(files, container, options = {}) {
    if (!files || files.length === 0) {
      container.innerHTML = this.renderEmptyState(options.emptyMessage || 'No files yet', options.emptySubtext || 'Upload files to get started');
      return;
    }

    if (this.viewMode === 'list') {
      this.renderFileList(files, container, options);
    } else {
      this.renderFileGrid(files, container, options);
    }
  },

  renderFileGrid(files, container, options = {}) {
    const html = `<div class="file-grid">
      ${(options.folders || []).map(f => `
        <div class="folder-card" data-folder-id="${f.id}">
          <div class="folder-card-icon">&#128193;</div>
          <div class="folder-card-name">${this.escapeHtml(f.name)}</div>
        </div>
      `).join('')}
      ${files.map(f => {
        const cat = this.getCategoryInfo(f.category);
        const isImage = f.category === 'images';
        return `
        <div class="file-card" data-file-id="${f.id}" draggable="true">
          <div class="file-card-actions">
            <button class="action-btn" data-action="download" data-file-id="${f.id}" title="Download">&#11015;</button>
            <button class="action-btn" data-action="preview" data-file-id="${f.id}" title="Preview">&#128065;</button>
            <button class="action-btn delete-btn" data-action="delete" data-file-id="${f.id}" title="Delete">&#128465;</button>
          </div>
          ${isImage
            ? `<img class="file-card-image" src="/api/files/${f.id}/preview" alt="${this.escapeHtml(f.original_name)}" loading="lazy">`
            : `<div class="file-card-icon ${cat.class}">${cat.icon}</div>`
          }
          <div class="file-card-name" title="${this.escapeHtml(f.original_name)}">${this.escapeHtml(f.original_name)}</div>
          <div class="file-card-meta">
            <span>${this.formatSize(f.size)}</span>
            <span>${this.formatDate(f.created_at)}</span>
          </div>
          ${f.snippet ? `<div class="search-snippet">${f.snippet}</div>` : ''}
          ${f.tags && f.tags.length ? `<div class="file-card-tags">${f.tags.map(t => `<span class="tag-sm">${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
    container.innerHTML = html;
    this.bindFileEvents(container);
  },

  renderFileList(files, container, options = {}) {
    const html = `<div class="file-list">
      ${(options.folders || []).map(f => `
        <div class="file-list-item" data-folder-id="${f.id}">
          <div class="file-list-icon" style="background:#f59e0b;font-size:16px;">&#128193;</div>
          <div class="file-list-name">${this.escapeHtml(f.name)}</div>
          <div class="file-list-date">${this.formatDate(f.created_at)}</div>
          <div class="file-list-size">Folder</div>
          <div class="file-list-actions"></div>
        </div>
      `).join('')}
      ${files.map(f => {
        const cat = this.getCategoryInfo(f.category);
        return `
        <div class="file-list-item" data-file-id="${f.id}" draggable="true">
          <div class="file-list-icon ${cat.class}">${cat.icon}</div>
          <div class="file-list-name" title="${this.escapeHtml(f.original_name)}">
            ${this.escapeHtml(f.original_name)}
            ${f.snippet ? `<div class="search-snippet">${f.snippet}</div>` : ''}
          </div>
          <div class="file-list-date">${this.formatDate(f.created_at)}</div>
          <div class="file-list-size">${this.formatSize(f.size)}</div>
          <div class="file-list-actions">
            <button class="btn-icon action-btn" data-action="download" data-file-id="${f.id}" title="Download">&#11015;</button>
            <button class="btn-icon action-btn delete-btn" data-action="delete" data-file-id="${f.id}" title="Delete">&#128465;</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
    container.innerHTML = html;
    this.bindFileEvents(container);
  },

  bindFileEvents(container) {
    // Card clicks -> preview
    container.querySelectorAll('[data-file-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.action-btn') || e.target.closest('.file-card-actions') || e.target.closest('.file-list-actions')) return;
        const id = el.dataset.fileId;
        if (id) App.showPreview(id);
      });
    });

    // Folder clicks + drop targets in main area
    container.querySelectorAll('[data-folder-id]').forEach(el => {
      el.addEventListener('click', () => {
        App.navigateToFolder(parseInt(el.dataset.folderId));
      });
      // Drop target
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
          await App.moveFileToFolder(parseInt(fileId), parseInt(el.dataset.folderId));
        }
      });
    });

    // Drag start for files
    container.querySelectorAll('[data-file-id][draggable]').forEach(el => {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-file-id', el.dataset.fileId);
        e.dataTransfer.effectAllowed = 'move';
        el.classList.add('dragging');
        // Enable drop targets
        setTimeout(() => document.body.classList.add('file-dragging'), 0);
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        document.body.classList.remove('file-dragging');
        document.querySelectorAll('.drag-over').forEach(d => d.classList.remove('drag-over'));
      });
    });

    // Action buttons
    container.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.fileId;
        if (action === 'download') API.downloadFile(id);
        if (action === 'delete') App.deleteFile(id);
        if (action === 'preview') App.showPreview(id);
      });
    });
  },

  // Render folder tree in sidebar
  renderFolderTree(folders, container) {
    const buildTree = (parentId = null) => {
      const children = folders.filter(f => f.parent_id === parentId);
      if (!children.length) return '';
      return children.map(f => `
        <div class="folder-item ${App.state.folderId === f.id ? 'active' : ''}" data-folder-id="${f.id}">
          <span class="folder-icon">&#128193;</span>
          <span>${this.escapeHtml(f.name)}</span>
          <span class="folder-actions">
            <button data-action="rename-folder" data-folder-id="${f.id}" title="Rename">&#9998;</button>
            <button data-action="delete-folder" data-folder-id="${f.id}" title="Delete">&#128465;</button>
          </span>
        </div>
        <div class="folder-children">${buildTree(f.id)}</div>
      `).join('');
    };

    container.innerHTML = buildTree();

    if (!folders.length) {
      container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px 10px;">No folders yet</div>';
    }

    // Bind events
    container.querySelectorAll('.folder-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-action]')) return;
        App.navigateToFolder(parseInt(el.dataset.folderId));
      });
    });

    // Folder drop targets in sidebar
    container.querySelectorAll('.folder-item').forEach(el => {
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
          await App.moveFileToFolder(parseInt(fileId), parseInt(el.dataset.folderId));
        }
      });
    });

    container.querySelectorAll('[data-action="rename-folder"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        App.renameFolder(parseInt(btn.dataset.folderId));
      });
    });

    container.querySelectorAll('[data-action="delete-folder"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        App.deleteFolderAction(parseInt(btn.dataset.folderId));
      });
    });
  },

  // Render tag cloud
  renderTags(tags, container) {
    if (!tags.length) {
      container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">No tags yet</div>';
      return;
    }
    container.innerHTML = tags.map(t =>
      `<span class="tag-pill" data-tag="${this.escapeHtml(t.tag)}">${this.escapeHtml(t.tag)} <span class="tag-count">${t.count}</span></span>`
    ).join('');

    container.querySelectorAll('.tag-pill').forEach(el => {
      el.addEventListener('click', () => App.filterByTag(el.dataset.tag));
    });
  },

  // Render stats
  renderStats(stats, container) {
    container.innerHTML = `
      <div>${stats.total_files || 0} files &middot; ${this.formatSize(stats.total_size || 0)}</div>
    `;
  },

  // Breadcrumb
  renderBreadcrumb(parts, container) {
    container.innerHTML = parts.map((p, i) => {
      if (i === parts.length - 1) return `<span class="current">${this.escapeHtml(p.label)}</span>`;
      return `<a data-action="${p.action || ''}" data-id="${p.id || ''}">${this.escapeHtml(p.label)}</a><span class="separator">/</span>`;
    }).join('');

    container.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        const action = a.dataset.action;
        if (action === 'home') App.showRecent();
        else if (action === 'folder') App.navigateToFolder(parseInt(a.dataset.id));
      });
    });
  },

  // Empty state
  renderEmptyState(title, subtitle) {
    return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
      <h3>${title}</h3>
      <p>${subtitle}</p>
    </div>`;
  },

  // Preview modal
  async showPreviewModal(file) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const overlay = document.getElementById('modalOverlay');

    title.textContent = file.original_name;

    let previewHtml = '';
    const previewUrl = API.getPreviewUrl(file.id);

    if (file.category === 'images') {
      previewHtml = `<img class="preview-image" src="${previewUrl}" alt="${this.escapeHtml(file.original_name)}">`;
    } else if (file.category === 'pdfs') {
      previewHtml = `<iframe class="preview-iframe" src="${previewUrl}"></iframe>`;
    } else if (file.extracted_text) {
      const text = file.extracted_text.substring(0, 5000);
      previewHtml = `<div class="preview-text">${this.escapeHtml(text)}${file.extracted_text.length > 5000 ? '\n\n... (truncated)' : ''}</div>`;
    } else {
      previewHtml = `<div class="empty-state"><h3>Preview not available</h3><p>Download the file to view its contents</p></div>`;
    }

    // Meta info
    const cat = this.getCategoryInfo(file.category);
    previewHtml += `
    <div class="preview-meta">
      <div class="preview-meta-grid">
        <div class="meta-item"><label>Type</label><span>${cat.label}</span></div>
        <div class="meta-item"><label>Size</label><span>${this.formatSize(file.size)}</span></div>
        <div class="meta-item"><label>Uploaded</label><span>${this.formatDate(file.created_at)}</span></div>
        <div class="meta-item"><label>Modified</label><span>${this.formatDate(file.updated_at)}</span></div>
      </div>
      <label style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-muted);">Tags</label>
      <div class="tag-editor" id="tagEditor">
        ${(file.tags || []).map(t => `<span class="tag-chip">${this.escapeHtml(t)} <span class="remove-tag" data-tag="${this.escapeHtml(t)}" data-file-id="${file.id}">&times;</span></span>`).join('')}
        <input type="text" class="tag-input" id="tagInput" placeholder="Add tag..." data-file-id="${file.id}">
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-primary" onclick="API.downloadFile(${file.id})">&#11015; Download</button>
        <button class="btn btn-secondary" onclick="App.moveFile(${file.id})">&#128193; Move</button>
        <button class="btn btn-danger" onclick="App.deleteFile(${file.id}); document.getElementById('modalOverlay').classList.remove('active');">&#128465; Delete</button>
      </div>
    </div>`;

    body.innerHTML = previewHtml;
    overlay.classList.add('active');

    // Tag events
    body.querySelectorAll('.remove-tag').forEach(el => {
      el.addEventListener('click', async () => {
        await API.removeTag(el.dataset.fileId, el.dataset.tag);
        el.parentElement.remove();
        App.loadTags();
      });
    });

    const tagInput = body.querySelector('#tagInput');
    if (tagInput) {
      tagInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && tagInput.value.trim()) {
          const tag = tagInput.value.trim().toLowerCase();
          await API.addTag(tagInput.dataset.fileId, tag);
          tagInput.value = '';
          // Refresh preview
          const updated = await API.getFile(file.id);
          this.showPreviewModal(updated);
          App.loadTags();
        }
      });
    }
  },

  // Dialog
  showDialog(title, bodyHtml, onConfirm) {
    const overlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    modalTitle.textContent = title;
    body.innerHTML = `
      <div class="dialog-form">
        ${bodyHtml}
        <div class="dialog-actions">
          <button class="btn btn-secondary" id="dialogCancel">Cancel</button>
          <button class="btn btn-primary" id="dialogConfirm">Confirm</button>
        </div>
      </div>`;

    overlay.classList.add('active');

    document.getElementById('dialogCancel').onclick = () => overlay.classList.remove('active');
    document.getElementById('dialogConfirm').onclick = () => {
      onConfirm();
      overlay.classList.remove('active');
    };

    // Focus first input
    const input = body.querySelector('input');
    if (input) setTimeout(() => input.focus(), 100);
  },

  // Toast notification
  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  // Show/hide upload progress
  showProgress(percent, text) {
    const el = document.getElementById('uploadProgress');
    const bar = document.getElementById('progressBar');
    const txt = document.getElementById('progressText');
    el.classList.add('active');
    bar.style.setProperty('--progress', percent + '%');
    txt.textContent = text || `Uploading... ${percent}%`;
  },

  hideProgress() {
    document.getElementById('uploadProgress').classList.remove('active');
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
