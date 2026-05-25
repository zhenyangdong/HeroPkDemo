# 个人知识库

一个轻量的本地知识库工具：把资料丢进 `articles/` 目录，自动解析、分类、检索、阅读与自然语言问答。

## 启动

```bash
npm install
npm start
```

打开 http://localhost:3000 即可。

## 目录结构

```
knownedge/
├── articles/          # 👉 把你的 .md 文章放这里（支持子目录作为分类）
│   ├── 欢迎使用.md
│   └── 技术/
│       └── Markdown速查.md
├── public/            # 前端静态资源
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── server.js          # 后端服务（Express）
└── package.json
```

## 支持的文件格式

| 格式 | 说明 |
| --- | --- |
| `.md` / `.markdown` | Markdown，支持 Frontmatter 元数据 |
| `.txt` | 纯文本（按原文显示） |
| `.html` / `.htm` | 提取 `<title>` 与 `<body>`，自动去除 `<script>` |
| `.docx` | Word（新版），转换为 HTML 保留排版 |
| `.pptx` | PowerPoint（新版），按幻灯片提取文字 |
| `.xlsx` | Excel（新版），提取单元格文本 |
| `.pdf` | PDF，提取文本（不含图片） |

⚠️ **不支持的旧版二进制格式**：`.doc` / `.ppt` / `.xls`。请在 Office 中“另存为”新版（`.docx` / `.pptx` / `.xlsx`）后再放入。

## 功能

- 📂 自动扫描 `articles/` 目录及子目录中的 `.md` / `.markdown` 文件
- 🏷️ 支持 Frontmatter（`title` / `tags` / `category` / `date` / `summary`），不写也能自动推断
- 🔍 全文搜索（标题 + 摘要 + 正文 + 标签）
- 💬 自然语言问答（基于文档段落抽取答案，并返回来源）
- 🗂️ 按分类 / 标签过滤
- 📊 总字数、阅读时间估算
- 🎨 Markdown 渲染 + 代码高亮（GitHub 风格）

## 开发

```bash
npm run dev   # 文件改动自动重启（Node 18+）
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/articles?q=&tag=&category=` | 文章列表 |
| GET | `/api/articles/:id` | 文章详情（含渲染后的 HTML） |
| GET | `/api/stats` | 统计 / 分类 / 标签 |
| POST | `/api/qa` | 自然语言问答（Body: `{ question }`） |
| POST | `/api/upload` | 上传文件（FormData: `files[]`, `category?`） |
| POST | `/api/refresh` | 强制重新扫描 |

## 后续可扩展功能（按需添加）

- [ ] 图片 / 附件支持（articles 目录内的资源）
- [ ] 双向链接 `[[wiki]]` 语法
- [ ] AI 自动摘要 / 标签提取
- [ ] 收藏 / 阅读历史
- [ ] 全文索引（lunr / minisearch）以加速大库检索
- [ ] 暗色模式
- [ ] 导出 PDF / 静态站点
