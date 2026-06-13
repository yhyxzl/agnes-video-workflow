# Agnes Studio

AI 视频生成工作流平台 - 前端 + 后端完整架构

## 系统架构

```
+------------------------------------------------------------------+
|                    Frontend (React + Vite)                       |
|  +-------------+ +----------+ +----------+ +------------------+ |
|  | 提示词优化   | | 图片生成  | |工作流编辑器| | 批量执行         | |
|  +------+------+ +----+-----+ +----+-----+ +--------+---------+ |
|         |              |            |               |            |
|  +------v--------------v------------v---------------v----------+ |
|  |              API Client (Zustand Store)                     | |
|  +---------------------------------------------+--------------+ |
+-----------------------------------------------|-----------------+
                                                | HTTP
                                    +-----------v-----------------+
                                    |   FastAPI Backend :8000     |
                                    |  Route Handlers             |
                                    |  Workflow Execution Engine  |
                                    +-------------|---------------+
                                                  |
                                    +-------------v---------------+
                                    |   Agnes AI API              |
                                    |   apihub.agnes-ai.com       |
                                    +-----------------------------+
```

## 功能模块

| 模块 | 路径 | 功能 |
|------|------|------|
| 提示词优化 | `/` | 与 AI 对话优化提示词，自动提取优化结果 |
| 图片生成 | `/images` | 文生图，支持多种尺寸和数量 |
| 工作流编辑器 | `/workflow` | 可视化编排生成步骤，导入导出 JSON |
| 批量执行 | `/batch` | 批量运行工作流，多轮变体扫描 |
| 输出管理 | `/gallery` | 查看/筛选/下载所有生成结果 |

## 项目结构

```
Agnes-Studio/
+-- backend/
|   +-- main.py              # FastAPI 入口
|   +-- run.py               # 启动脚本
|   +-- requirements.txt     # Python 依赖
|   +-- .env.example         # 环境变量模板
|   +-- app/
|   |   +-- config.py        # 配置管理
|   |   +-- models.py        # Pydantic 数据模型
|   +-- api/
|       +-- routes.py        # API 路由
|       +-- engine.py        # 工作流执行引擎
+-- frontend/
|   +-- index.html
|   +-- package.json
|   +-- vite.config.js
|   +-- tailwind.config.js
|   +-- postcss.config.js
|   +-- src/
|       +-- main.jsx
|       +-- App.jsx          # 主应用 + 路由 + 布局
|       +-- index.css        # Tailwind 样式
|       +-- store/
|       |   +-- api.js       # API 客户端
|       +-- pages/
|           +-- PromptOptimize.jsx
|           +-- ImageGenerate.jsx
|           +-- WorkflowBuilder.jsx
|           +-- BatchExecute.jsx
|           +-- OutputGallery.jsx
+-- templates/               # 可放入 ComfyUI workflow JSON
+-- outputs/                 # 生成的输出文件
```

## 快速开始

### 1. 后端

    cd backend
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    copy .env.example .env
    # 编辑 .env，填入 AGNES_API_KEY
    python run.py
    # 后端运行在 http://127.0.0.1:8000
    # API 文档: http://127.0.0.1:8000/docs

### 2. 前端

    cd frontend
    npm install
    npm run dev
    # 前端运行在 http://localhost:5173
    # Vite 自动代理 /api 请求到后端 :8000

### 3. 构建生产版本

    cd frontend
    npm run build
    # 产物在 frontend/dist/
    # 后端 main.py 会自动 serve 静态文件

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 对话/提示词优化 |
| POST | `/api/images/generate` | 图片生成 |
| POST | `/api/video/generate` | 视频生成 |
| POST | `/api/batch/submit` | 提交批量任务 |
| GET  | `/api/batch/jobs` | 列出所有任务 |
| GET  | `/api/batch/job/{id}` | 查看任务状态 |
| POST | `/api/batch/job/{id}/cancel` | 取消任务 |
| GET  | `/api/outputs` | 列出所有输出 |
| GET  | `/api/download/{filename}` | 下载文件 |

## 工作流编排

工作流由多个步骤组成，按顺序执行:

1. **提示词优化** (chat_optimize) - AI 优化你的提示词
2. **文生图** (text2image) - 根据提示词生成图片
3. **文生视频** (text2video) - 根据提示词直接生成视频
4. **图生视频** (image2video) - 基于图片生成视频（需要上一步的输出）

## 技术栈

- **后端**: Python 3.10+ / FastAPI / httpx / Pydantic
- **前端**: React 18 / Vite / Tailwind CSS / React Router
- **状态管理**: Zustand
- **AI API**: Agnes AI (OpenAI-compatible)
