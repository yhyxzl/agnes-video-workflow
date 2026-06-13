"""Workflow execution engine for batch processing."""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Optional

from app.models import (
    WorkflowStep, WorkflowBatch, BatchJobStatus,
    WorkflowStepType, ChatRequest, ChatMessage, ImageRequest, VideoRequest,
)
from agnes_client.core import AgnesClient, AgnesAPIError
from app.config import settings, format_bj


class WorkflowEngine:
    """Executes workflow steps sequentially or with batch sweeps."""

    def __init__(self, client: AgnesClient):
        self.client = client

    async def execute(self, workflow: WorkflowBatch) -> list[dict]:
        """Execute all steps in the workflow, with batch sweep support."""
        results = []
        steps_to_run = [workflow]
        if workflow.input_variations:
            steps_to_run = [self._sweep_workflow(workflow, var) for var in workflow.input_variations]

        for i, wf in enumerate(steps_to_run):
            step_results = await self._execute_workflow(wf, batch_idx=i)
            results.extend(step_results)
        return results

    def _sweep_workflow(self, workflow: WorkflowBatch, variation: dict) -> WorkflowBatch:
        """Apply input variations to a workflow."""
        new_steps = []
        for step in workflow.steps:
            new_config = dict(step.config)
            for key, val in variation.items():
                if key in new_config:
                    new_config[key] = val
                elif key == "prompt":
                    new_config["prompt"] = val
            new_steps.append(WorkflowStep(
                id=f"{step.id}_sweep",
                type=step.type,
                prompt=step.prompt,
                config=new_config,
            ))
        return WorkflowBatch(name=f"{workflow.name}_sweep", steps=new_steps)

    async def _execute_workflow(self, workflow: WorkflowBatch, batch_idx: int = 0) -> list[dict]:
        """Execute a single workflow instance."""
        results = []
        prev_image_url: Optional[str] = None
        prev_prompt = workflow.steps[0].prompt if workflow.steps else ""

        for i, step in enumerate(workflow.steps):
            try:
                if step.type == WorkflowStepType.CHAT_OPTIMIZE:
                    prompt = await self._optimize_prompt(step, batch_idx)
                    prev_prompt = prompt
                    results.append({"step": i, "type": "prompt", "result": prompt})

                elif step.type == WorkflowStepType.TEXT2IMAGE:
                    img_results = await self._generate_image(step, prev_prompt, batch_idx)
                    results.extend(img_results)
                    if img_results:
                        prev_image_url = img_results[-1].get("url")

                elif step.type in (WorkflowStepType.IMAGE2VIDEO, WorkflowStepType.TEXT2VIDEO):
                    vid_results = await self._generate_video(step, prev_prompt, prev_image_url, batch_idx)
                    results.extend(vid_results)

            except Exception as e:
                results.append({"step": i, "type": str(step.type), "error": str(e)})

        return results

    async def _optimize_prompt(self, step: WorkflowStep, batch_idx: int) -> str:
        """Step: optimize the prompt using chat model."""
        system = "You are a prompt optimization expert for video/image generation. Make prompts detailed and vivid."
        messages_dicts = [
            {"role": "system", "content": system},
            {"role": "user", "content": step.prompt or step.config.get("prompt", "Generate a creative description.")}
        ]
        payload = {
            "model": "agnes-2.0-flash",
            "messages": messages_dicts,
            "max_tokens": 1024,
        }
        resp = await self.client._post("chat/completions", payload)
        choices = resp.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", step.prompt or "")
        return step.prompt or ""

    async def _generate_image(self, step: WorkflowStep, prompt: str, batch_idx: int) -> list[dict]:
        """Step: generate image from text prompt."""
        size = step.config.get("size", "1024x1024")
        n = step.config.get("n", 1)
        model = step.config.get("model", "agnes-image-2.1-flash")
        payload = {
            "prompt": prompt,
            "model": model,
            "size": size,
            "n": n,
        }
        resp = await self.client._post("images/generations", payload)
        out = []
        for j, img in enumerate(resp.get("data", [])):
            out.append({"type": "image", "url": img.get("url"), "prompt": prompt, "batch_idx": batch_idx})
        return out

    async def _generate_video(self, step: WorkflowStep, prompt: str, image_url: Optional[str], batch_idx: int) -> list[dict]:
        """Step: generate video."""
        model = step.config.get("model", "agnes-video-v2.0")
        payload: dict = {
            "prompt": prompt,
            "model": model,
        }
        if image_url:
            payload["image_url"] = image_url
        resp = await self.client._post("video/generations", payload)
        if resp.get("status") == "completed":
            return [{"type": "video", "url": resp.get("video_url"), "prompt": prompt, "batch_idx": batch_idx}]
        return [{"type": "video", "error": resp.get("message", "Unknown error"), "batch_idx": batch_idx}]
