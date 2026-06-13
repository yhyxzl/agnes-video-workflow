"""Pydantic models for request/response schemas."""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Chat / Prompt Optimization ──
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str = "agnes-2.0-flash"
    max_tokens: int = Field(default=1024, ge=1, le=8192)


class ChatResponse(BaseModel):
    id: str
    model: str
    choices: list[dict[str, Any]]
    usage: Optional[dict[str, int]] = None
    system_prompt: str = "你是一位专业的视频生成提示词优化专家。你的任务是根据用户的需求，生成高质量、详细的视频生成提示词。"


# ── Image Generation ──
class ImageRequest(BaseModel):
    prompt: str
    model: str = "agnes-image-2.1-flash"
    size: str = "1024x1024"
    n: int = Field(default=1, ge=1, le=4)


class ImageResponse(BaseModel):
    created: int
    data: list[dict[str, Any]]


# ── Video Generation ──
class VideoRequest(BaseModel):
    prompt: str
    model: str = "agnes-video-v2.0"
    image_url: Optional[str] = None  # optional image-to-video
    width: Optional[int] = None      # custom resolution width
    height: Optional[int] = None     # custom resolution height
    num_frames: Optional[int] = None  # frame count (8n+1, max 441)
    frame_rate: Optional[int] = None  # fps (1-60)


class VideoResponse(BaseModel):
    status: str
    video_id: Optional[str] = None
    task_id: Optional[str] = None
    video_url: Optional[str] = None  # field renamed from remixed_from_video_id
    progress: Optional[int] = None
    message: Optional[str] = None


# ── Workflow / Batch ──
class WorkflowStepType(str, Enum):
    CHAT_OPTIMIZE = "chat_optimize"
    TEXT2IMAGE = "text2image"
    IMAGE2VIDEO = "image2video"
    TEXT2VIDEO = "text2video"


class WorkflowStep(BaseModel):
    id: str
    type: WorkflowStepType
    prompt: str
    config: dict[str, Any] = {}


class WorkflowBatch(BaseModel):
    name: str
    steps: list[WorkflowStep]
    input_variations: Optional[list[dict[str, str]]] = None  # for batch sweeps


class BatchRequest(BaseModel):
    workflow: WorkflowBatch


class BatchJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class BatchJob(BaseModel):
    id: str
    workflow: WorkflowBatch
    status: BatchJobStatus = BatchJobStatus.PENDING
    results: list[dict[str, Any]] = []
    error: Optional[str] = None
    created_at: str = ""
    completed_at: Optional[str] = None


# ── Output / Result ──
class OutputItem(BaseModel):
    id: str
    type: str  # "image", "video"
    url: str
    thumbnail_url: Optional[str] = None
    created_at: str
    metadata: dict[str, Any] = {}
