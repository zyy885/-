# 📚 研途单词 · 单词测试系统

面向机构老师的智能单词测试平台 — 老师发布任务，学生背单词并测试，老师实时查看进度。

---

## ✨ 完整功能清单

### 👨‍🏫 老师端

| 功能 | 说明 |
|------|------|
| 📝 **词表管理** | 创建词表、增删改查单词、批量添加、智能导入/导出 |
| 🧠 **智能导入** | 支持 JSON / CSV / TXT / 任意文本，自动识别分隔符和字段 |
| 📤 **词表导出** | 一键导出为 JSON 格式，方便备份和共享 |
| 🎯 **发布任务** | 选词表、设题数与截止时间、分配给指定学生 |
| 📊 **进度追踪** | 查看每个学生的学习进度、测试分数、完成状态 |
| 📥 **批量导入学生** | 一次性导入多个学生账号 |
| 📊 **导出成绩** | 任务成绩导出为 CSV 表格 |
| 🔄 **任务重置** | 重置单个学生的任务进度 |
| 💬 **写评语** | 给学生写留言/评语，支持关联具体任务 |
| 👥 **账号管理** | 创建/删除老师和学生账号 |

### 🎒 学生端

| 功能 | 说明 |
|------|------|
| 📋 **任务列表** | 查看所有分配的测试任务和状态 |
| 🔄 **背单词** | 闪卡模式，点击查看释义，标记认识/不认识 |
| ✅ **单词测试** | 随机出题，输入中文释义，提交即出成绩 |
| 📖 **词表总览** | 浏览所有已分配词表的全部单词 |
| 🔊 **单词发音** | 所有显示单词的地方都有发音按钮（浏览器 TTS） |
| ⭐ **收藏单词** | 重点单词一键收藏，随时复习 |
| ❌ **错题本** | 自动收录做错的单词，针对性复习 |
| 📊 **学习统计** | 总任务、已测试、平均分、学习天数、已学单词、错题数 |
| 🏆 **排行榜** | 同学之间的学习排名（按平均分、学习天数） |
| 💬 **查看留言** | 查看老师的评语和留言 |

### ⚙️ 通用功能

| 功能 | 说明 |
|------|------|
| 🔑 **修改密码** | 设置页自主修改登录密码 |
| 🌙 **深色/浅色主题** | 一键切换主题，护眼舒适 |
| 📱 **PWA 支持** | 手机浏览器"添加到主屏幕"即可当 APP 使用 |
| 📱 **移动端优化** | 全响应式设计，手机/平板/电脑完美适配 |

---

## 🚀 快速启动（3 步）

### 前置要求
电脑安装 **Node.js**（建议 v18 或更高版本）
- 下载：https://nodejs.org/zh-cn

### 启动方式

#### 方式一：一键启动（推荐）

**Windows：**
```
双击 start.bat
```

**Mac / Linux：**
```bash
cd vocab-app
chmod +x start.sh
./start.sh
```

#### 方式二：手动启动

```bash
# 1. 安装后端依赖
cd vocab-app/backend
npm install

# 2. 构建前端（首次或修改前端后执行）
cd ../frontend
npm install
npm run build

# 3. 启动服务
cd ../backend
node src/server.js
```

启动成功后，浏览器打开：**http://localhost:3001**

---

## 🔑 默认账号

| 用户名 | 密码 | 身份 |
|--------|------|------|
| `teacher` | `123456` | 老师 |
| `student1` | `123456` | 学生 |
| `student2` | `123456` | 学生 |

> 学生可以自行注册账号（注册默认是学生身份）。老师账号只能由已有老师在「账号管理」中创建。登录后可在「设置」修改密码。

---

## 📖 使用流程

### 老师操作

1. 用 `teacher` 账号登录
2. 进入「**词表管理**」→ 新建词表 → 添加单词
   - 支持单个添加、批量添加（每行一个）、**智能导入**（JSON/CSV/TXT/任意文本）
   - 已有词表可以一键导出 JSON
3. 进入「**任务管理**」→ 发布任务 → 选择词表、设置题数、勾选学生
4. 在「**任务管理**」中点击「**查看进度**」→ 实时看到每个学生的学习进度和测试分数
   - 可以给学生写评语
   - 可以导出成绩 CSV
   - 可以重置学生的任务进度

### 学生操作

1. 用学生账号登录（如 `student1`），或在登录页自行注册
2. 在「**我的任务**」里看到老师发布的任务
3. 点「**背单词**」进入闪卡模式学习
   - 🔊 可听发音
   - ⭐ 可收藏重点单词
   - 标记"认识"或"不认识"
4. 学习后点「**开始测试**」→ 答题 → 提交即可看到成绩
5. 其他功能：
   - 「**词表总览**」：浏览所有单词
   - 「**错题本**」：复习做错的单词
   - 「**收藏**」：复习收藏的重点单词
   - 「**统计**」：查看自己的学习数据
   - 「**排行**」：查看同学排名
   - 「**留言**」：查看老师评语

---

## 🧠 智能词表导入功能

支持多种格式自动识别，无需手动配置：

### 支持的输入格式

```
# JSON 格式（最完整）
{"name":"Unit 1","words":[{"word":"apple","meaning":"苹果","example":"I eat an apple."}]}

# CSV / TXT 格式
apple,苹果
banana,香蕉,我喜欢吃香蕉
cat : 猫
dog  狗

# 甚至任意中英混排文本
apple苹果 banana香蕉 cat-猫 橙子orange
```

### 智能特性

- **多格式自动识别**：JSON、CSV、TXT、任意文本
- **多种分隔符**：逗号、中文逗号、制表符、冒号、空格、多空格自动尝试
- **模糊字段匹配**：`word/term/en`、`meaning/definition/zh/translation` 都能识别
- **中英混排提取**：杂乱文本中自动提取英文-中文单词对
- **自动去重**：相同单词自动合并
- **词表名自动提取**：从文件名推断词表名称
- **表头自动跳过**：`单词/word/英语` 开头的表头行自动忽略
- **实时预览**：粘贴内容后自动解析，可直接编辑每个单词后再确认导入

---

## 🌐 部署到公网

### 方案一：云服务器（推荐）

1. 把整个 `vocab-app` 文件夹上传到服务器
2. 安装 Node.js：
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```
3. 一键启动：
```bash
cd vocab-app
./start.sh
```
4. 用 `http://服务器IP:3001` 访问

**配置开机自启（systemd）：**
```bash
cat > /etc/systemd/system/vocab.service << 'EOF'
[Unit]
Description=研途单词
After=network.target

[Service]
Type=simple
WorkingDirectory=/root/vocab-app/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl enable vocab
systemctl start vocab
```

### 方案二：手机当 APP 用（PWA）

部署到公网并配置 HTTPS 后：
- **iPhone (Safari)**：打开网址 → 点分享按钮 → 添加到主屏幕
- **安卓 (Chrome)**：打开网址 → 菜单 → 安装应用

桌面就会出现「研途单词」APP 图标，点开即用，无需下载。

---

## 🗂 项目结构

```
vocab-app/
├── start.sh              # Mac/Linux 一键启动
├── start.bat             # Windows 一键启动
├── README.md             # 本文件
├── backend/              # 后端服务 (Node.js + Express + SQLite)
│   ├── package.json
│   ├── vocab.db          # 数据库文件（运行后自动生成）
│   └── src/
│       ├── server.js     # API 主入口（同时托管前端静态文件）
│       ├── db.js         # 数据库初始化和所有表结构
│       └── auth.js       # JWT 认证中间件
└── frontend/             # 前端 (React + Vite)
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── public/           # 静态资源 (PWA manifest, 图标, sw.js)
    ├── dist/             # 构建产物（后端自动托管，npm run build 生成）
    └── src/
        ├── main.jsx
        ├── App.jsx       # 路由 + 导航栏 + 全局布局
        ├── api.js        # 所有 API 调用封装
        ├── styles.css    # 全局样式（含深色主题、移动端适配）
        └── pages/        # 20 个页面组件
            ├── Login.jsx
            ├── TeacherDashboard.jsx
            ├── StudentDashboard.jsx
            ├── WordListManage.jsx      # 词表管理（含智能导入）
            ├── TaskManage.jsx
            ├── ProgressView.jsx
            ├── StudyPage.jsx
            ├── TestPage.jsx
            ├── StudentWordLists.jsx
            ├── UserManage.jsx
            ├── WrongBook.jsx
            ├── Favorites.jsx
            ├── StatsPage.jsx
            ├── Leaderboard.jsx
            ├── CommentsTeacher.jsx
            ├── CommentsStudent.jsx
            ├── SettingsPage.jsx         # 修改密码 + 主题切换
            └── StudentProfile.jsx
```

---

## 💾 数据备份

所有数据都存储在一个文件里：`backend/vocab.db`（SQLite 数据库）

直接复制这个文件就是完整备份，粘贴回去就是完整恢复。

---

## 🛠 技术栈

- **前端**：React 18 + Vite + React Router 6
- **后端**：Node.js + Express + JWT 认证
- **数据库**：SQLite（零配置，单文件，better-sqlite3 驱动）
- **样式**：原生 CSS，全响应式，深色/浅色主题
- **移动端**：PWA（Service Worker + Web Manifest）
- **发音**：浏览器内置 Web Speech API

---

## ❓ 常见问题

**Q: 端口 3001 被占用了怎么办？**
A: 启动时设置环境变量：`PORT=8080 node src/server.js`

**Q: 怎么修改密码？**
A: 登录后点右上角 ⚙️ 进入「设置」即可修改密码。

**Q: 学生忘记密码怎么办？**
A: 老师可以在「账号管理」中删除该学生账号，让学生重新注册。

**Q: 前端修改后怎么更新？**
A: 在 `frontend` 目录下执行 `npm run build`，然后刷新浏览器即可（无需重启后端）。

**Q: 发音功能没声音？**
A: 确保浏览器允许网页播放声音。Chrome/Safari/Edge 都支持，部分浏览器需要用户先点击一次页面后才允许语音。

**Q: 手机怎么装成 APP？**
A: 用手机浏览器打开部署好的网址：
- iPhone（Safari）：点底部分享按钮 → 添加到主屏幕
- 安卓（Chrome）：点右上角菜单 → 安装应用
