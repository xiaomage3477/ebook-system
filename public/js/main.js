// ============ 工具函数 ============
function showToast(message, type = 'success') {
  const container = document.querySelector('.toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${type === 'success' ? '#2ed573' : '#e74c5c'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${type === 'success'
        ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
        : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
    </svg>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.className = 'toast-container';
  document.body.appendChild(c);
  return c;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// ============ 首页 - 书籍列表 ============
if (document.getElementById('booksGrid')) {
  loadBooks();
}

async function loadBooks() {
  const grid = document.getElementById('booksGrid');
  const emptyState = document.getElementById('emptyState');
  const loading = document.getElementById('loading');

  try {
    const res = await fetch('/api/books');
    const data = await res.json();
    loading.style.display = 'none';

    if (!data.success || !data.data.length) {
      emptyState.style.display = 'block';
      return;
    }

    grid.innerHTML = data.data.map(book => `
      <div class="book-card" onclick="location.href='/book/${book._id}'">
        <div class="book-cover">
          ${book.coverUrl ? `<img src="/api/proxy-image?url=${encodeURIComponent(book.coverUrl)}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`}
          ${book.pageCount ? `<span class="page-count">${book.pageCount} 页</span>` : ''}
        </div>
        <div class="book-info">
          <h3>${book.title}</h3>
          <div class="book-meta">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${book.author}
            </span>
            <span>${formatSize(book.size)}</span>
          </div>
          <div class="book-actions">
            <a href="/reader/${book._id}" class="btn btn-primary btn-sm" onclick="event.stopPropagation()">阅读</a>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteBook('${book._id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    loading.innerHTML = '<p style="color: var(--danger);">加载失败</p>';
  }
}

async function deleteBook(id) {
  if (!confirm('确定要删除这本书吗？')) return;
  try {
    const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('删除成功');
      loadBooks();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('删除失败', 'error');
  }
}

// ============ 上传页 ============
if (document.getElementById('uploadForm')) {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('pdfFile');
  const fileName = document.getElementById('fileName');
  const searchSection = document.getElementById('searchSection');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchResults = document.getElementById('searchResults');
  let searchTimer = null;

  // 从文件名提取书名（去掉扩展名和常见噪音词）
  function extractBookName(filename) {
    let name = filename.replace(/\.[^.]+$/, '');
    // 去掉常见噪音
    name = name
      .replace(/\[.*?\]/g, '')
      .replace(/（.*?）/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/(精校|校对|排版|epub|mobi|azw3|pdf|txt|完结|全本|番外|作者|著|译)/gi, '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return name;
  }

  // 调用后端搜索接口（后端使用豆瓣读书 API）
  async function searchBook(keyword) {
    if (!keyword || keyword.length < 2) {
      searchResults.innerHTML = '<div class="search-empty">关键词太短，请输入更多字符</div>';
      return;
    }
    searchResults.innerHTML = '<div class="search-loading"><div class="spinner" style="width:24px;height:24px;"></div> 正在搜索...</div>';
    try {
      const res = await fetch(`/api/search-book?q=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      const results = data.success ? data.data : [];

      if (!results.length) {
        searchResults.innerHTML = '<div class="search-empty">未找到相关书籍，请尝试修改关键词</div>';
        return;
      }
      searchResults.innerHTML = results.map((book, i) => `
        <div class="search-item" data-index="${i}">
          ${book.cover ? `<img src="${book.cover}" class="search-cover" alt="">` : '<div class="search-cover-placeholder">📚</div>'}
          <div class="search-item-info">
            <div class="search-item-title">${book.title}</div>
            <div class="search-item-author">${book.author || '未知作者'}</div>
            <div class="search-item-meta">${book.publisher || ''} ${book.publishedDate || ''} ${book.pageCount ? book.pageCount + '页' : ''}</div>
          </div>
        </div>
      `).join('');

      // 绑定点击事件
      searchResults.querySelectorAll('.search-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          const book = results[i];
          document.getElementById('title').value = book.title;
          document.getElementById('author').value = book.author || '';
          document.getElementById('description').value = book.description || '';
          // 保存封面 URL 到隐藏字段
          let coverField = document.getElementById('coverUrl');
          if (!coverField) {
            coverField = document.createElement('input');
            coverField.type = 'hidden';
            coverField.id = 'coverUrl';
            coverField.name = 'coverUrl';
            document.getElementById('uploadForm').appendChild(coverField);
          }
          coverField.value = book.cover || '';
          searchResults.innerHTML = `<div class="search-selected">已选择：<strong>${book.title}</strong> - ${book.author || '未知作者'}</div>`;
          showToast(`已填充「${book.title}」的信息`);
        });
      });
    } catch (err) {
      searchResults.innerHTML = '<div class="search-empty">搜索出错，请稍后重试</div>';
    }
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      const fname = e.dataTransfer.files[0].name;
      fileName.textContent = fname;
      const bookName = extractBookName(fname);
      searchSection.style.display = 'block';
      searchInput.value = bookName;
      searchBook(bookName);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      const fname = fileInput.files[0].name;
      fileName.textContent = fname;
      const bookName = extractBookName(fname);
      searchSection.style.display = 'block';
      searchInput.value = bookName;
      searchBook(bookName);
    }
  });

  // 手动搜索按钮
  searchBtn.addEventListener('click', () => searchBook(searchInput.value.trim()));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchBook(searchInput.value.trim()); }
  });

  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = '上传中...';

    try {
      const res = await fetch('/api/books/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        showToast('上传成功');
        setTimeout(() => location.href = '/', 1000);
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      showToast('上传失败', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '上传';
    }
  });
}

// ============ 详情页 ============
if (document.getElementById('bookDetail')) {
  const id = location.pathname.split('/').pop();
  loadBookDetail(id);
}

async function loadBookDetail(id) {
  const container = document.getElementById('bookDetail');
  const loading = document.getElementById('loading');

  try {
    const res = await fetch(`/api/books/${id}`);
    const data = await res.json();
    loading.style.display = 'none';

    if (!data.success) {
      container.innerHTML = '<div class="empty-state"><h3>书籍未找到</h3></div>';
      return;
    }

    const book = data.data;
    container.innerHTML = `
      <div class="detail-header">
        <div class="detail-cover">
          ${book.coverUrl ? `<img src="/api/proxy-image?url=${encodeURIComponent(book.coverUrl)}" alt="${book.title}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`}
        </div>
        <div class="detail-info">
          <h1>${book.title}</h1>
          <div class="detail-meta">
            <span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${book.author}
            </span>
            <span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
              ${book.pageCount || '未知'} 页
            </span>
            <span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              ${formatSize(book.size)}
            </span>
            <span>上传于 ${formatDate(book.createdAt)}</span>
          </div>
          ${book.description ? `<div class="detail-desc">${book.description}</div>` : ''}
          <div class="detail-actions">
            <a href="/reader/${book._id}" class="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              在线阅读
            </a>
            <a href="/uploads/${book.filename}" class="btn btn-secondary" download>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              下载 PDF
            </a>
            <button class="btn btn-danger" onclick="deleteBookFromDetail('${book._id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              删除
            </button>
          </div>
        </div>
      </div>
    `;
    container.style.display = 'block';
  } catch (err) {
    loading.innerHTML = '<p style="color: var(--danger);">加载失败</p>';
  }
}

async function deleteBookFromDetail(id) {
  if (!confirm('确定要删除这本书吗？')) return;
  try {
    const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('删除成功');
      setTimeout(() => location.href = '/', 1000);
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('删除失败', 'error');
  }
}

// ============ 阅读器 ============
if (document.getElementById('pdfViewer')) {
  initReader();
}

async function initReader() {
  const id = location.pathname.split('/').pop();
  let pdfDoc = null;
  let pageNum = 1;
  let scale = 1.2;
  const canvas = document.getElementById('pdfCanvas');
  const ctx = canvas.getContext('2d');

  try {
    const res = await fetch(`/api/books/${id}`);
    const data = await res.json();
    if (!data.success) { showToast('书籍未找到', 'error'); return; }

    const book = data.data;
    document.getElementById('readerTitle').textContent = book.title;
    document.getElementById('backLink').href = `/book/${id}`;

    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const loadingTask = pdfjsLib.getDocument(`/uploads/${book.filename}`);
    pdfDoc = await loadingTask.promise;
    document.getElementById('totalPages').textContent = pdfDoc.numPages;

    renderPage(pageNum);

    document.getElementById('prevPage').addEventListener('click', () => {
      if (pageNum <= 1) return;
      pageNum--;
      renderPage(pageNum);
    });

    document.getElementById('nextPage').addEventListener('click', () => {
      if (pageNum >= pdfDoc.numPages) return;
      pageNum++;
      renderPage(pageNum);
    });

    document.getElementById('zoomIn').addEventListener('click', () => {
      scale = Math.min(scale + 0.2, 3);
      renderPage(pageNum);
    });

    document.getElementById('zoomOut').addEventListener('click', () => {
      scale = Math.max(scale - 0.2, 0.5);
      renderPage(pageNum);
    });

    document.getElementById('pageInput').addEventListener('change', (e) => {
      const num = parseInt(e.target.value);
      if (num >= 1 && num <= pdfDoc.numPages) {
        pageNum = num;
        renderPage(pageNum);
      }
    });

    async function renderPage(num) {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: ctx, viewport }).promise;
      document.getElementById('currentPage').textContent = num;
      document.getElementById('pageInput').value = num;
      document.getElementById('prevPage').disabled = num <= 1;
      document.getElementById('nextPage').disabled = num >= pdfDoc.numPages;
    }
  } catch (err) {
    showToast('PDF 加载失败', 'error');
  }
}
