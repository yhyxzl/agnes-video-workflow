==================================================================
  Agnes Studio — 完整环境依赖清单
==================================================================
  适用场景：全新 Windows 电脑 / VM 虚拟机 / 零环境部署
  Python 3.10-3.14 / Node.js 18-24 全兼容
==================================================================

┌─────────────────────────────────────────────────────────────────┐
│                       一、运行环境                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [必须] Python  3.10+  (推荐 3.12，最新 3.14 也可)              │
│    下载: https://www.python.org/downloads/                       │
│    安装时务必勾选 ☑ "Add Python to PATH"                         │
│    验证: python --version                                        │
│                                                                  │
│  [必须] Node.js  18+  (推荐 22 LTS，最新 24 也可)               │
│    下载: https://nodejs.org/                                     │
│    验证: node --version                                          │
│                                                                  │
│  [可选] Git (用于版本管理)                                        │
│    下载: https://git-scm.com/downloads/win                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   二、Python 依赖（后端）                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  文件位置: backend/requirements.txt                              │
│  安装命令: pip install -r backend/requirements.txt               │
│                                                                  │
│  ├─ fastapi==0.115.0          Web 框架                           │
│  ├─ uvicorn[standard]==0.30.0 ASGI 服务器 (含 watchfiles 热重载) │
│  ├─ python-dotenv==1.0.0      .env 文件加载                      │
│  ├─ httpx==0.27.0             HTTP 客户端 (Agnes API 调用)       │
│  ├─ pydantic==2.9.0           数据模型验证                       │
│  ├─ pydantic-settings==2.5.0  配置管理 (读取 .env)               │
│  ├─ websockets==13.1          WebSocket 支持                     │
│  ├─ python-multipart==0.0.9   文件上传解析                       │
│  ├─ aiofiles==24.1.0          异步文件读写                       │
│  └─ aiohttp>=3.9.0            异步 HTTP (下载图片/视频)          │
│                                                                  │
│  安装后验证（在 backend 目录下运行）:                              │
│    python -c "from main import app; print('OK', len(app.routes))" │
│    输出: OK 22                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  三、Node.js 依赖（前端）                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  文件位置: frontend/package.json                                 │
│  安装命令: cd frontend && npm install                            │
│                                                                  │
│  ├─ react ^18.3.1              UI 框架                          │
│  ├─ react-dom ^18.3.1          DOM 渲染                         │
│  ├─ react-router-dom ^6.26.0   路由                              │
│  ├─ zustand ^4.5.5             状态管理                          │
│  ├─ @xyflow/react ^12.3.0      React Flow 可视化画布            │
│  ├─ vite ^5.4.0                构建工具/开发服务器               │
│  ├─ @vitejs/plugin-react ^4.3.0 Vite React 插件                  │
│  ├─ tailwindcss ^3.4.13        CSS 框架                         │
│  ├─ autoprefixer ^10.4.20      CSS 兼容前缀                     │
│  └─ postcss ^8.4.47            CSS 处理器                       │
│                                                                  │
│  安装后验证:                                                     │
│    cd frontend && npx vite --version                             │
│    输出: vite/5.x.x ...                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               四、环境变量 / 配置文件                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  文件位置: backend/.env (不存在则自动创建)                        │
│                                                                  │
│  AGNES_API_KEY=            ← 必填! 从平台获取                    │
│  APP_PORT=8090                                                   │
│  APP_HOST=127.0.0.1                                              │
│  CORS_ORIGINS=http://localhost:5173,http://localhost:3000         │
│  OUTPUT_DIR=./outputs      ← 生成文件的保存目录                   │
│  BATCH_MAX_CONCURRENT=3                                          │
│                                                                  │
│  获取 API Key: https://platform.agnes-ai.com/settings/apiKeys     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              五、完整安装步骤（一键脚本）                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ 方法 A: 双击 setup.bat（推荐）                              │
│  │  自动完成: 环境检测 → venv创建 → pip install → npm install   │
│  │                                                               │
│  └─ 方法 B: 手动安装                                             │
│                                                                  │
│  1. 安装 Python + Node.js（见第一部分）                          │
│                                                                  │
│  2. 安装后端依赖:                                                │
│     cd backend                                                    │
│     python -m venv venv                                           │
│     venv\Scripts\activate                                        │
│     pip install --prefer-binary -r requirements.txt              │
│     deactivate                                                    │
│                                                                  │
│  3. 安装前端依赖:                                                │
│     cd frontend                                                   │
│     npm install                                                   │
│                                                                  │
│  4. 配置 API Key:                                                │
│     编辑 backend/.env，填入 AGNES_API_KEY                        │
│                                                                  │
│  5. 启动:                                                        │
│     双击 launcher.py 或 python launcher.py                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               六、常见安装问题                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Q: Python 3.14 安装报错？                                       │
│  A: 部分包尚未发布 3.14 wheel，用 --prefer-binary 会尝试         │
│     二进制安装。如果仍失败，用 Python 3.12 更稳定。              │
│                                                                  │
│  Q: pip install 很慢？                                           │
│  A: 1) 国内用户加镜像: pip install -r requirements.txt           │
│        -i https://pypi.tuna.tsinghua.edu.cn/simple               │
│     2) 或用 --timeout 60 延长超时                                │
│                                                                  │
│  Q: npm install 报错 EFTYPE/esbuild？                             │
│  A: Windows 安全软件拦截了 esbuild.exe。手动解封：               │
│     PowerShell -Command "Unblock-File node_modules\@esbuild\     │
│     win32-x64\esbuild.exe"                                       │
│     或: npm install esbuild (重新下载)                            │
│                                                                  │
│  Q: npm install 卡住？                                           │
│  A: 加 --ignore-scripts 跳过 esbuild 的自动安装:                │
│     npm install --ignore-scripts && npm install esbuild          │
│                                                                  │
│  Q: 端口被占用？                                                 │
│  A: launcher.py 会自动切换端口，无需手动处理。                   │
│     后端默认 9191，前端默认 5173。                                │
│                                                                  │
│  Q: launch.py 提示"后端启动失败"？                                │
│  A: 查看 backend/backend.log 获取具体错误。                      │
│     常见: Python 版本不兼容 / pip 依赖缺失 / 端口冲突            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

==================================================================
  文件版本: v1.0 | 更新日期: 2026-06-13
  生成: Senior Developer (高级开发工程师)
==================================================================
