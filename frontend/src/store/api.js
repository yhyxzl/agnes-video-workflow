const STORAGE_KEY = "agnes_settings"

export function getApiConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveApiConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export const API_BASE = "/api"

export async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const config = getApiConfig()
  const headers = { "Content-Type": "application/json" }
  if (config.apiKey) headers["X-Agnes-Api-Key"] = config.apiKey
  if (config.baseUrl) headers["X-Agnes-Base-Url"] = config.baseUrl
  if (config.outputDir) headers["X-Agnes-Output-Dir"] = config.outputDir
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(err.detail || `API Error ${response.status}`)
  }
  return response.json()
}

// Chat / Prompt Optimization
export async function chat(messages, model = "agnes-2.0-flash") {
  return apiCall("/chat", {
    method: "POST",
    body: JSON.stringify({ messages, model, max_tokens: 1024 }),
  })
}

// Image Generation
export async function generateImage(prompt, size = "1024x1024", n = 1, model = "agnes-image-2.1-flash") {
  return apiCall("/images/generate", {
    method: "POST",
    body: JSON.stringify({ prompt, size, n, model }),
  })
}

// Video Generation (Agnes API v2: POST /v1/videos)
export async function generateVideo(prompt, model = "agnes-video-v2.0", image_url = null, width = "", height = "", num_frames = "", frame_rate = "") {
  const body = { prompt, model }
  if (image_url) body.image_url = image_url
  if (width) body.width = width
  if (height) body.height = height
  if (num_frames) body.num_frames = num_frames
  if (frame_rate) body.frame_rate = frame_rate
  return apiCall("/video/generate", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// Batch Jobs
export async function submitBatch(workflow) {
  return apiCall("/batch/submit", {
    method: "POST",
    body: JSON.stringify(workflow),
  })
}

export async function listBatchJobs() {
  return apiCall("/batch/jobs")
}

export async function getBatchJob(jobId) {
  return apiCall(`/batch/job/${jobId}`)
}

export async function cancelBatchJob(jobId) {
  return apiCall(`/batch/job/${jobId}/cancel`, { method: "POST" })
}

// Video Status Polling (uses video_id, NOT task_id)
export async function getVideoStatus(videoId) {
  return apiCall(`/video/status/${videoId}`)
}

// Outputs
export async function listOutputs() {
  return apiCall("/outputs")
}

// Image Upload (multipart/form-data for local files)
export async function uploadImage(file) {
  const formData = new FormData()
  formData.append("file", file)
  const config = getApiConfig()
  const headers = {}
  if (config.apiKey) headers["X-Agnes-Api-Key"] = config.apiKey
  if (config.baseUrl) headers["X-Agnes-Base-Url"] = config.baseUrl
  if (config.outputDir) headers["X-Agnes-Output-Dir"] = config.outputDir
  const response = await fetch(`${API_BASE}/upload/image`, {
    method: "POST",
    headers,
    body: formData,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(err.detail || `Upload Error ${response.status}`)
  }
  return response.json()
}

// Sync settings to backend (in-memory)
export async function syncSettings(config) {
  try {
    const response = await fetch(`${API_BASE}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: config.apiKey || "",
        baseUrl: config.baseUrl || "",
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

// Verify current settings with backend
export async function verifySettings() {
  return apiCall("/settings/verify")
}

// Directory Browser
export async function browseDirectory(path) {
  return apiCall(`/browse-directory?path=${encodeURIComponent(path)}`)
}

export async function browseRoots() {
  return apiCall("/browse-roots")
}
