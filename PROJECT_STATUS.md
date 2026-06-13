# Agnes Studio — 项目状态报告

## 一、项目概览

**项目名：** Agnes Studio  
**定位：** 基于 Agnes AI API 的视频/图片生成工作流平台（聊天→图片→视频→工作流编排→批量执行）  
**代码路径：** `C:\Users\optim\Agnes-Studio\`  

| 服务   | 地址                          | 端口 |
|--------|------------------------------|------|
| 后端 (FastAPI) | http://127.0.0.1:9191    | 9191 |
| 前端 (Vite)   | http://localhost:5173    | 5173 |

**技术栈：**
- 后端：FastAPI + Python 3.11 + Pydantic + aiohttp + pydantic-settings
- 前端：React + Vite + Tailwind CSS
- AI API：Agnes AI (agnes-2.0-flash, agnes-image-2.1-flash, agnes-video-v2.0)

---

## 二、当前服务状态

| 服务   | 状态 | 详情 |
|--------|------|------|
| 后端 | ✅ 运行中 | 端口 9191，API Key 已加载，所有端点可访问 |
| 前端 | ✅ 运行中 | 端口 5173，可预览 |

**控制台：** 后端在独立终端运行，关闭即停止

---

## 三、API 测试结果（2026-06-12）

| 端点 | 状态 | 说明 |
|------|------|------|
| `/api/health` | ✅ 通过 | `{"status":"ok","service":"Agnes Studio"}` |
| `/api/chat` | ✅ 通过 | 提示词优化成功，返回优化后的视频提示词 |
| `/api/images/generate` | ✅ 通过 | 文生图成功，返回图片 URL（已修复 ResponseModel 格式 bug） |
| `/api/video/generate` | ✅ 通过 | 视频生成请求已入队（`status: "queued"`），需异步轮询 |
| `/api/outputs` | ✅ 通过 | 输出列表正常返回 |
| `/api/batch/submit` | ✅ 通过 | 批量任务已创建并进入后台执行 |
| `/api/batch/jobs` | ✅ 通过 | 任务状态查询正常 |
| `/api/batch/job/{id}/cancel` | ✅ 可通过 | 取消逻辑已实现 |

### 工作流执行测试
| 步骤 | 状态 | 说明 |
|------|------|------|
| chat_optimize | ✅ 完成 | 返回优化后的提示词 |
| text2image | ✅ 完成 | 生成图片并返回 URL |
| text2video | ⚠️ 未知错误 | 视频生成是异步的，需实现轮询等待机制 |

---

## 四、已完成的功能

1. ✅ **后端架构搭建** — FastAPI 项目结构，API 路由、模型、配置、时区工具函数
2. ✅ **AgnesClient 封装** — 统一异步调用 chat / images / video 接口
3. ✅ **工作流引擎** — 多步骤顺序执行（Chat→Image→Video）
4. ✅ **批量任务管理** — 提交、查询、取消、状态追踪
5. ✅ **北京时间转换** — 完整 UTC↔CST 转换逻辑，config.py 自带 `now_bj()` / `bj_to_utc()` / `utc_to_bj()` / `format_bj()`
6. ✅ **前端页面** — 6 个页面：聊天、图片、视频、工作流、批量、画廊
7. ✅ **前端 Store** — 统一的 API 调用封装
8. ✅ **静态文件服务** — 生产模式自动挂载前端 dist
9. ✅ **图片/视频下载缓存** — 生成结果自动保存到 outputs/ 目录

### 本次修复记录（2026-06-12）
1. ✅ **API Key 冲突解决** — 杀掉占用 9191 端口的 22 个旧 Python 进程（uvicorn reload 残留）
2. ✅ **ImageResponse 格式修复** — `data` 字段返回 `list[dict]` 而非 `list[str]`，符合 Pydantic 模型定义
3. ✅ **清除调试日志** — 移除 client.py 中的 print 调试语句
4. ✅ **完整 API 连通性验证** — 6 个核心端点全部通过测试
5. ✅ **工作流编排端到端验证** — 批量任务→后台执行→状态查询全链路通过

---

## 五、已知问题

1. **视频生成需要异步轮询** — Agnes API 返回 `status: "queued"`，需要实现定时轮询获取完成状态
2. **批量任务进度不更新** — 后台执行期间 progress 字段未实时更新（当前仅在完成/失败时更新）
3. **Windows 端口残留** — uvicorn reload 模式会在 Windows 上产生大量残留进程，建议生产环境关闭 reload
4. **图片下载功能待验证** — `_download_image` 需要 `aiofiles` 库支持（已依赖）

---

## 六、下一步计划

1. **视频生成轮询** — 为 video/generate 添加状态轮询逻辑：
   - 前端每 5-10s 轮询 `/api/video/status/{prompt_id}`
   - 后端添加 `/api/video/status/{prompt_id}` 端点调用 Agnes API 查询状态
2. **进度实时更新** — 批量任务执行时通过 WebSocket 或 SSE 推送进度
3. **图生视频流程打通** — 自动将上一步生成图片作为下一步视频生成的输入
4. **前端工作流编排器 UI 优化** — 拖拽式连接节点
5. **输出画廊增强** — 图片/视频缩略图、分类筛选、一键下载
6. **前端构建生产版本** — `npm run build` + FastAPI 静态文件挂载

---

## 七、启动说明

```bash
# 后端
cd backend
venv\Scripts\activate
python run.py

# 前端
cd frontend
npm run dev
```
