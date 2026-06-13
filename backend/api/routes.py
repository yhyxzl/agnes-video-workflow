"""FastAPI routes for the Agnes Video Workflow application."""
from __future__ import annotations

import os
import uuid
import aiofiles
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, UploadFile, File
from fastapi.responses import FileResponse

from app.models import (
    ChatRequest, ChatResponse,
    ImageRequest, ImageResponse,
    VideoRequest, VideoResponse,
    WorkflowStep, WorkflowBatch,
    BatchJob, BatchJobStatus,
)
from app.config import settings, format_bj, utc_to_bj
from agnes_client.core import AgnesClient, AgnesAPIError
from api.engine import WorkflowEngine

router = APIRouter(prefix="/api")

_default_output_dir = Path(settings.output_dir)
_default_output_dir.mkdir(parents=True, exist_ok=True)

# In-memory job store
jobs: dict[str, dict] = {}


def get_output_dir(request: Request) -> Path:
    """Return output directory from frontend header if set, else fallback to .env."""
    header_dir = request.headers.get("x-agnes-output-dir")
    if header_dir:
        p = Path(header_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p
    return _default_output_dir


# ── Chat / Prompt Optimization ──
@router.post("/chat", response_model=ChatResponse)
async def chat(request: Request, body: ChatRequest):
    """Send a message to the Agnes chat model for prompt optimization."""
    try:
        client = get_client(request)
        msgs = [{"role": m.role, "content": m.content} for m in body.messages]
        payload = {
            "model": body.model,
            "messages": msgs,
            "max_tokens": body.max_tokens,
        }
        resp = await client._post("chat/completions", payload)
        return ChatResponse(
            id=resp.get("id", ""),
            model=resp.get("model", ""),
            choices=resp.get("choices", []),
            usage=resp.get("usage"),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Image Generation ──
@router.post("/images/generate", response_model=ImageResponse)
async def generate_image(request: Request, body: ImageRequest):
    """Generate images from a text prompt."""
    try:
        # Validate image dimensions (must be multiples of 16)
        if body.size:
            parts = body.size.lower().split("x")
            if len(parts) == 2:
                w, h = parts
                if w.isdigit() and h.isdigit():
                    iw, ih = int(w), int(h)
                    if iw % 16 != 0 or ih % 16 != 0:
                        raise HTTPException(status_code=400, detail=f"图片尺寸必须为 16 的倍数，当前为 {iw}×{ih}")
        client = get_client(request)
        payload = {
            "prompt": body.prompt,
            "model": body.model,
            "size": body.size,
            "n": body.n,
        }
        resp = await client._post("images/generations", payload)
        data_list = resp.get("data", [])
        out_dir = get_output_dir(request)
        # Download images to local output_dir and return local URLs
        saved_data = []
        for img in data_list:
            url = img.get("url")
            if url:
                local_fname = await _download_image(url, img, out_dir)
                entry = {"url": url, **{k: v for k, v in img.items() if k != "url"}}
                if local_fname:
                    entry["local_url"] = f"/api/download/{local_fname}"
                saved_data.append(entry)
        return ImageResponse(
            created=resp.get("created", 0),
            data=saved_data,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


async def _download_image(url: str, metadata: dict, out_dir: Path) -> str | None:
    """Download image from URL to local outputs directory. Returns local filename or None."""
    try:
        import aiohttp
        filename = Path(url).name
        if not filename or not filename.endswith(('.png', '.jpg', '.jpeg', '.webp')):
            filename = f"image_{uuid.uuid4().hex[:8]}.png"
        filepath = out_dir / filename
        client = AgnesClient(settings.agnes_api_key, settings.agnes_base_url)
        headers = client._headers()
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                if resp.status == 200:
                    content = await resp.read()
                    async with aiofiles.open(filepath, 'wb') as f:
                        await f.write(content)
                    print(f"[Outputs] Saved image: {filepath}")
                    return filename
    except Exception as e:
        print(f"[Outputs] Failed to save image: {e}")
    return None


# ── Video Generation (Agnes API v2: POST /v1/videos) ──
@router.post("/video/generate", response_model=VideoResponse)
async def generate_video(request: Request, body: VideoRequest):
    """Generate video using Agnes API v2 (POST /v1/videos)."""
    try:
        # Validate video dimensions (must be multiples of 64)
        if body.width and body.width % 64 != 0:
            raise HTTPException(status_code=400, detail=f"视频宽度必须为 64 的倍数，当前为 {body.width}")
        if body.height and body.height % 64 != 0:
            raise HTTPException(status_code=400, detail=f"视频高度必须为 64 的倍数，当前为 {body.height}")
        client = get_client(request)
        payload: dict = {
            "model": body.model,
            "prompt": body.prompt,
        }
        # image field (singular, string or array)
        if body.image_url:
            payload["image"] = body.image_url
        # resolution
        if body.width:
            payload["width"] = body.width
        if body.height:
            payload["height"] = body.height
        if body.num_frames:
            payload["num_frames"] = body.num_frames
        if body.frame_rate:
            payload["frame_rate"] = body.frame_rate

        # POST /v1/videos (endpoint is "videos" under /v1 base)
        resp = await client._post("videos", payload)
        status = resp.get("status", "pending")
        video_id = resp.get("video_id")
        task_id = resp.get("task_id") or resp.get("id")
        progress = resp.get("progress", 0)
        # On success, the video_url is only available via status poll
        return VideoResponse(
            status=status,
            video_id=video_id,
            task_id=task_id,
            progress=progress,
            message=resp.get("message"),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


async def _download_video(url: str, out_dir: Path):
    """Download completed video from URL to local outputs directory."""
    try:
        import aiohttp
        import aiofiles
        fname = f"video_{uuid.uuid4().hex[:8]}.mp4"
        filepath = out_dir / fname
        async with aiofiles.open(filepath, 'wb') as f:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=600)) as resp:
                    if resp.status == 200:
                        while True:
                            chunk = await resp.content.read(8192)
                            if not chunk:
                                break
                            await f.write(chunk)
                        print(f"[Outputs] Saved video: {filepath}")
                        return str(filepath)
        return None
    except Exception as e:
        print(f"[Outputs] Failed to save video: {e}")
        return None


# ── Video Status Polling (GET /agnesapi?video_id=XXX) ──
@router.get("/video/status/{video_id}")
async def get_video_status(request: Request, video_id: str):
    """Poll video generation status using video_id via /agnesapi endpoint."""
    try:
        client = get_client(request)
        # Build the correct URL: https://apihub.agnes-ai.com/agnesapi?video_id=XXX
        base_root = client.base_url.replace("/v1", "")  # strip /v1 to get root
        status_url = f"{base_root}/agnesapi?video_id={video_id}"
        resp = await client._get_agnesapi(status_url)
        status = resp.get("status", "unknown")
        video_url = resp.get("remixed_from_video_id")  # key field for completed video
        progress = resp.get("progress", 0)
        # Auto-download when completed
        saved_local = None
        if status == "completed" and video_url:
            out_dir = get_output_dir(request)
            saved_local = await _download_video(video_url, out_dir)
        return {
            "status": status,
            "video_id": video_id,
            "video_url": video_url,
            "progress": progress,
            "local_path": saved_local,
            "message": resp.get("error") or resp.get("message"),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── Batch Execution ──
@router.post("/batch/submit", response_model=BatchJob)
async def submit_batch(request: Request, req: WorkflowBatch, background_tasks: BackgroundTasks):
    """Submit a batch workflow job and execute it in the background."""
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    bj_now = datetime.now(ZoneInfo("Asia/Shanghai"))
    # Capture frontend API config for background execution
    fe_api_key = request.headers.get("x-agnes-api-key") or ""
    fe_base_url = request.headers.get("x-agnes-base-url") or ""
    job = {
        "id": job_id,
        "workflow": req.model_dump(),
        "status": "running",
        "results": [],
        "error": None,
        "created_at": format_bj(bj_now),
        "completed_at": None,
        "progress": "0%",
        "current_step": 0,
        "total_steps": len(req.steps),
        "_fe_api_key": fe_api_key,
        "_fe_base_url": fe_base_url,
    }
    jobs[job_id] = job

    # Execute in background
    background_tasks.add_task(_execute_batch_job, job_id, req, fe_api_key, fe_base_url)
    return BatchJob(**job)


async def _execute_batch_job(job_id: str, req: WorkflowBatch, fe_api_key: str = "", fe_base_url: str = ""):
    """Execute batch workflow in background and update job status."""
    try:
        api_key = fe_api_key or settings.agnes_api_key
        base_url = fe_base_url or settings.agnes_base_url
        client = AgnesClient(api_key, base_url)
        engine = WorkflowEngine(client)
        results = await engine.execute(req)

        jobs[job_id]["status"] = "completed"
        jobs[job_id]["results"] = results
        jobs[job_id]["completed_at"] = format_bj(datetime.now(ZoneInfo("Asia/Shanghai")))
        jobs[job_id]["progress"] = "100%"
        print(f"[Batch] Job {job_id} completed with {len(results)} results")
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["completed_at"] = format_bj(datetime.now(ZoneInfo("Asia/Shanghai")))
        print(f"[Batch] Job {job_id} failed: {e}")


@router.get("/batch/jobs")
async def list_batch_jobs():
    """List all batch jobs."""
    return list(jobs.values())


@router.get("/batch/job/{job_id}")
async def get_batch_job(job_id: str):
    """Get status of a specific batch job."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/batch/job/{job_id}/cancel")
async def cancel_batch_job(job_id: str):
    """Cancel a running batch job."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job["status"] = "failed"
    job["error"] = "Cancelled by user"
    job["completed_at"] = format_bj(datetime.now(ZoneInfo("Asia/Shanghai")))
    return {"status": "cancelled", "job_id": job_id}


# ── Dynamic Settings (from frontend config) ──
_IN_MEMORY_API_KEY: str | None = None
_IN_MEMORY_BASE_URL: str | None = None


@router.post("/settings")
async def update_settings(request: Request, body: dict):
    """Dynamically update API settings from the frontend (in-memory)."""
    global _IN_MEMORY_API_KEY, _IN_MEMORY_BASE_URL
    if "apiKey" in body:
        key = body["apiKey"].strip()
        if key:
            _IN_MEMORY_API_KEY = key
            print(f"[Settings] Updated API Key (masked): {key[:6]}...{key[-4:]}")
        else:
            _IN_MEMORY_API_KEY = None
    if "baseUrl" in body:
        _IN_MEMORY_BASE_URL = body["baseUrl"].strip() or None
    return {"status": "ok", "updated": list(body.keys())}


@router.get("/settings/verify")
async def verify_settings(request: Request):
    """Verify that the current settings are valid (test connection)."""
    try:
        client = get_client(request)
        # A lightweight test: try the models endpoint or a simple health check
        resp = await client._get("models")
        model_list = resp.get("data", []) if isinstance(resp, dict) else []
        return {
            "status": "ok",
            "has_api_key": True,
            "model_count": len(model_list) if model_list else 0,
            "api_base": client.base_url,
        }
    except Exception as e:
        return {
            "status": "error",
            "has_api_key": False,
            "message": str(e),
        }


def get_client(request: Request) -> AgnesClient:
    """Create a fresh client instance on each request.
    Uses frontend-provided headers if present, falls back to server .env,
    then falls back to in-memory config."""
    api_key = (
        request.headers.get("x-agnes-api-key")
        or settings.agnes_api_key
        or _IN_MEMORY_API_KEY
        or ""
    )
    base_url = (
        request.headers.get("x-agnes-base-url")
        or settings.agnes_base_url
        or _IN_MEMORY_BASE_URL
        or "https://apihub.agnes-ai.com/v1"
    )
    return AgnesClient(api_key, base_url)


# ── Image Upload (for image-to-video) ──
@router.post("/upload/image")
async def upload_image(request: Request, file: UploadFile = File(...)):
    """Upload a local image file to the output directory for use in image-to-video generation."""
    out_dir = get_output_dir(request)
    valid_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
    ext = os.path.splitext(file.filename or "image.png")[1].lower()
    if ext not in valid_exts:
        raise HTTPException(status_code=400, detail=f"不支持的图片格式: {ext}，支持: {', '.join(valid_exts)}")
    try:
        content = await file.read()
        fname = f"upload_{uuid.uuid4().hex[:12]}{ext}"
        fpath = out_dir / fname
        async with aiofiles.open(fpath, "wb") as f:
            await f.write(content)
        download_url = f"/api/download/{fname}"
        print(f"[Upload] Saved uploaded image: {fpath}")
        return {
            "status": "ok",
            "filename": fname,
            "url": download_url,
            "filepath": str(fpath),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")


# ── Directory Browser ──
@router.get("/browse-directory")
async def browse_directory(path: str = ""):
    """List subdirectories of a given path for the folder picker UI."""
    try:
        p = Path(path) if path else Path("/")
        if not p.exists() or not p.is_dir():
            return {"current": str(p), "parent": None, "dirs": []}

        parent = str(p.parent) if p.parent != p else None
        dirs = []
        for entry in sorted(p.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                try:
                    dirs.append({
                        "name": entry.name,
                        "path": str(entry),
                    })
                except Exception:
                    pass
        return {"current": str(p), "parent": parent, "dirs": dirs}
    except Exception as e:
        return {"current": path, "parent": None, "dirs": [], "error": str(e)}


@router.get("/browse-roots")
async def browse_roots():
    """List drive roots on Windows."""
    import subprocess
    try:
        result = subprocess.run(["wmic", "logicaldisk", "get", "name"], capture_output=True, text=True, timeout=5)
        drives = [line.strip() + "\\" for line in result.stdout.split("\n") if line.strip() and ":" in line]
        if not drives:
            drives = ["C:\\", "D:\\"]
        return {"drives": drives}
    except Exception:
        return {"drives": ["C:\\", "D:\\"]}


# ── Output Management ──
@router.get("/outputs")
async def list_outputs(request: Request):
    """List all generated output files."""
    out_dir = get_output_dir(request)
    outputs = []
    for f in out_dir.rglob("*"):
        if f.is_file():
            ext = f.suffix.lower()
            bj_time = utc_to_bj(datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc))
            outputs.append({
                "id": str(f.stem),
                "type": "video" if ext in (".mp4", ".webm", ".gif") else "image",
                "url": f"/api/download/{f.name}",
                "filename": f.name,
                "created_at": format_bj(bj_time),
                "size": f.stat().st_size,
            })
    outputs.sort(key=lambda x: x["created_at"], reverse=True)
    return outputs


@router.get("/download/{filename}")
async def download_output(request: Request, filename: str):
    """Download a generated output file."""
    out_dir = get_output_dir(request)
    filepath = out_dir / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath, filename=filename)
