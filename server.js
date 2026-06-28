const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const Datastore = require('nedb-promises');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据库
const db = new Datastore({ filename: path.join(__dirname, 'data', 'ebooks.db'), autoload: true });

// 确保目录存在
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
[uploadsDir, dataDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传 PDF 文件'), false);
    }
  }
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ========== 联网搜索书籍信息 ==========
function fetchUrl(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

app.get('/api/search-book', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });

    // 优先用豆瓣读书（国内可访问）
    let results = [];
    try {
      const doubanUrl = `https://book.douban.com/j/subject_suggest?q=${encodeURIComponent(q)}`;
      const doubanData = await fetchUrl(doubanUrl);
      if (Array.isArray(doubanData)) {
        results = doubanData
          .filter(item => item.type === 'b')
          .map(item => ({
            title: item.title || '',
            author: item.author_name || '',
            description: '',
            publisher: '',
            publishedDate: item.year || '',
            pageCount: 0,
            cover: item.pic || '',
            source: '豆瓣读书'
          }));
      }
    } catch (e) {
      console.log('豆瓣搜索失败:', e.message);
    }

    // 如果豆瓣没结果，用 Open Library
    if (!results.length) {
      try {
        const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6`;
        const olData = await fetchUrl(olUrl);
        if (olData.docs) {
          results = olData.docs.map(doc => ({
            title: doc.title || '',
            author: (doc.author_name || []).join(', '),
            description: '',
            publisher: (doc.publisher || []).join(', '),
            publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : '',
            pageCount: doc.number_of_pages_median || 0,
            cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
            source: 'Open Library'
          }));
        }
      } catch (e) {
        console.log('Open Library 搜索也失败:', e.message);
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== 图片代理（解决豆瓣防盗链） ==========
app.get('/api/proxy-image', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('missing url');
  try {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://book.douban.com/' }, timeout: 8000 }, (imgRes) => {
      if (imgRes.statusCode >= 300 && imgRes.statusCode < 400 && imgRes.headers.location) {
        // follow redirect
        const client2 = imgRes.headers.location.startsWith('https') ? https : http;
        client2.get(imgRes.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }, (imgRes2) => {
          res.setHeader('Content-Type', imgRes2.headers['content-type'] || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          imgRes2.pipe(res);
        }).on('error', () => res.status(502).end());
        return;
      }
      res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      imgRes.pipe(res);
    }).on('error', () => res.status(502).end());
  } catch (e) {
    res.status(500).end();
  }
});

// 页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'upload.html'));
});

app.get('/book/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'detail.html'));
});

app.get('/reader/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'reader.html'));
});

// API 路由
app.get('/api/books', async (req, res) => {
  try {
    const books = await db.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: books });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await db.findOne({ _id: req.params.id });
    if (!book) return res.status(404).json({ success: false, message: '书籍未找到' });
    res.json({ success: true, data: book });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/books/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '请选择 PDF 文件' });

    const { title, author, description, coverUrl } = req.body;
    const pdfParse = require('pdf-parse');

    let pageCount = 0;
    try {
      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      pageCount = pdfData.numpages || 0;
    } catch (e) {
      console.log('无法解析 PDF 元数据:', e.message);
    }

    const book = await db.insert({
      title: title || req.file.originalname.replace('.pdf', ''),
      author: author || '未知作者',
      description: description || '',
      coverUrl: coverUrl || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      pageCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, data: book, message: '上传成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/books/:id', async (req, res) => {
  try {
    const { title, author, description } = req.body;
    const book = await db.findOne({ _id: req.params.id });
    if (!book) return res.status(404).json({ success: false, message: '书籍未找到' });

    await db.update({ _id: req.params.id }, {
      $set: {
        title: title || book.title,
        author: author || book.author,
        description: description || book.description,
        updatedAt: new Date().toISOString()
      }
    });

    const updated = await db.findOne({ _id: req.params.id });
    res.json({ success: true, data: updated, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/books/:id', async (req, res) => {
  try {
    const book = await db.findOne({ _id: req.params.id });
    if (!book) return res.status(404).json({ success: false, message: '书籍未找到' });

    const filePath = path.join(uploadsDir, book.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.remove({ _id: req.params.id });
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`电子书管理系统已启动: http://localhost:${PORT}`);
});
