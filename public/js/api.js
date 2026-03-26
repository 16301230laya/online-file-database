// API Client - All fetch wrappers for backend communication
const API = {
  baseUrl: '',

  getToken() {
    return localStorage.getItem('auth_token');
  },

  setToken(token) {
    localStorage.setItem('auth_token', token);
  },

  clearToken() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('auth_user'));
    } catch { return null; }
  },

  setUser(user) {
    localStorage.setItem('auth_user', JSON.stringify(user));
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  async request(url, options = {}) {
    try {
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      const token = this.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(this.baseUrl + url, { headers, ...options });

      if (res.status === 401) {
        this.clearToken();
        window.location.reload();
        throw new Error('Session expired. Please login again.');
      }

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

  // Auth
  async login(email, password) {
    const result = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(result.token);
    this.setUser(result.user);
    return result;
  },

  async register(username, email, password) {
    const result = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
    this.setToken(result.token);
    this.setUser(result.user);
    return result;
  },

  async getAuthStatus() {
    return this.request('/api/auth/status');
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async listUsers() {
    return this.request('/api/auth/users');
  },

  async updateUserRole(id, role) {
    return this.request(`/api/auth/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  async deleteUser(id) {
    return this.request(`/api/auth/users/${id}`, { method: 'DELETE' });
  },

  logout() {
    this.clearToken();
    window.location.reload();
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

      // Add auth header
      const token = this.getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else if (xhr.status === 401) {
          this.clearToken();
          window.location.reload();
          reject(new Error('Session expired'));
        } else if (xhr.status === 403) {
          reject(new Error('Admin access required'));
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
    // Add token as query param for download
    const token = this.getToken();
    const url = `/api/files/${id}/download`;
    // Create a temporary link with auth
    const a = document.createElement('a');
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        a.href = URL.createObjectURL(blob);
        a.download = '';
        a.click();
        URL.revokeObjectURL(a.href);
      });
  },

  getPreviewUrl(id) {
    const token = this.getToken();
    return `/api/files/${id}/preview${token ? '?token=' + token : ''}`;
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
