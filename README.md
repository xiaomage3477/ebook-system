# 电子书管理系统

一个简洁的 PDF 电子书管理与在线阅读系统，支持上传、搜索、阅读和管理你的电子书收藏。

## 功能特性

- **PDF 上传**：支持点击选择和拖拽上传，自动解析页数
- **智能搜索**：上传时根据文件名自动联网搜索书籍信息（豆瓣读书），一键填充书名、作者、封面
- **在线阅读**：内置 PDF 阅读器，支持翻页、缩放、页码跳转
- **书籍管理**：查看书籍详情、下载原文件、删除书籍
- **封面展示**：自动获取豆瓣书籍封面，支持防盗链代理
- **暗色主题**：精心设计的深色 UI，阅读体验舒适

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | NeDB（嵌入式文件数据库） |
| 文件上传 | Multer |
| PDF 解析 | pdf-parse |
| 前端渲染 | 原生 HTML/CSS/JS |
| PDF 阅读 | PDF.js |
| 书籍搜索 | 豆瓣读书 API / Open Library API |

## 快速开始

### 环境要求

- Node.js >= 14

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/your-username/ebook-system.git
cd ebook-system

# 安装依赖
npm install

# 启动服务
npm start
```

启动后访问 http://localhost:3000

### 其他命令

```bash
npm run dev    # 开发模式（等同于 npm start）
```

## 项目结构

```
ebook-system/
├── server.js          # 后端服务入口
├── package.json       # 项目配置
├── data/              # 数据库文件目录
│   └── ebooks.db      # NeDB 数据库文件
├── uploads/           # PDF 文件上传目录
├── views/             # HTML 页面
│   ├── index.html     # 首页（书架）
│   ├── upload.html    # 上传页
│   ├── detail.html    # 书籍详情页
│   └── reader.html    # PDF 阅读器
└── public/            # 静态资源
    ├── css/style.css  # 样式文件
    └── js/main.js     # 前端逻辑
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/books` | 获取所有书籍 |
| GET | `/api/books/:id` | 获取书籍详情 |
| POST | `/api/books/upload` | 上传 PDF |
| PUT | `/api/books/:id` | 更新书籍信息 |
| DELETE | `/api/books/:id` | 删除书籍 |
| GET | `/api/search-book?q=关键词` | 搜索书籍信息 |
| GET | `/api/proxy-image?url=图片地址` | 封面图片代理 |
