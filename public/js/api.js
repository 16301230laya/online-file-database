// API Client - All fetch wrappers for backend communication
const API = {
  baseUrl: '',

  async request(url, options = {}) {
    try {
      const res = await fetch(this.baseUrl + url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
      }
      return res.json();
    } catch (err) {
      console.error(`API error [${url}]:`, err);
      throw err;
    }
  },

  // Files
  async uploadFiles(files, folderId = null, onProgress = null) {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (folderId) formData.append('folderId', folderId);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.baseUrl + '/api/files/upload');

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).error)); }
          catch { reject(new Error('Upload failed')); }
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(formData);
    });
  },

  async listFiles(params = {}) {
    const query = new URLSearchParams();
    if (params.folderId !== undefined) query.set('folderId', params.folderId);
    if (params.category) query.set('category', params.category);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    return this.request(`/api/files?${query}`);
  },

  async searchFiles(query) {
    return this.request(`/api/files/search?q=${encodeURIComponent(query)}`);
  },

  async getRecentFiles(limit = 20) {
    return this.request(`/api/files/recent?limit=${limit}`);
  },

  async getFileStats() {
    return this.request('/api/files/stats');
  },

  async getFile(id) {
    return this.request(`/api/files/${id}`);
  },

  downloadFile(id) {
    window.open(`/api/files/${id}/download`, '_blank');
  },

  getPreviewUrl(id) {
    return `/api/files/${id}/preview`;
  },

  async updateFile(id, data) {
    return this.request(`/api/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteFile(id) {
    return this.request(`/api/files/${id}`, { method: 'DELETE' });
  },

  // Folders
  async listFolders() {
    return this.request('/api/folders');
  },

  async getFolderContents(id) {
    return this.request(`/api/folders/${id}/contents`);
  },

  async createFolder(name, parentId = null) {
    return this.request('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId })
    });
  },

  async renameFolder(id, name) {
    return this.request(`/api/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
  },

  async deleteFolder(id) {
    return this.request(`/api/folders/${id}`, { method: 'DELETE' });
  },

  // Tags
  async getAllTags() {
    return this.request('/api/tags');
  },

  async addTag(fileId, tag) {
    return this.request(`/api/tags/file/${fileId}`, {
      method: 'POST',
      body: JSON.stringify({ tag })
    });
  },

  async removeTag(fileId, tag) {
    return this.request(`/api/tags/file/${fileId}/${encodeURIComponent(tag)}`, {
      method: 'DELETE'
    });
  },

  async getFilesByTag(tag) {
    return this.request(`/api/tags/${encodeURIComponent(tag)}/files`);
  }
};
