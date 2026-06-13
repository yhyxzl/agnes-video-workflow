import { useState, useEffect, useCallback, useRef } from "react"
import { chat, generateImage, generateVideo } from "../store/api"
import { useApp } from "../store/AppContext"

/* ─── SVG Icons ─── */
const SvgIcons = {
  play: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 2l10 6-10 6V2z" fill="currentColor"/></svg>,
  delete: <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M5.5 4V2.5a.5.5 0 01.5-.5h4a.5.5 0 01.5.5V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M4 4l1 9.5a1 1 0 001 .9h4a1 1 0 001-.9L12 4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>,
}

const MODELS = {
  chat_optimize: [
    { value: "agnes-2.0-flash", label: "Agnes 2.0 Flash" },
    { value: "agnes-2.0", label: "Agnes 2.0" },
  ],
  text2image: [
    { value: "agnes-image-2.1-flash", label: "Agnes Image 2.1 Flash" },
  ],
  text2video: [
    { value: "agnes-video-v2.0", label: "Agnes Video 2.0" },
  ],
  image2video: [
    { value: "agnes-video-v2.0", label: "Agnes Video 2.0" },
  ],
}

const NODE_COLORS = {
  chat_optimize: { color: "#7F77DD", light: "#EEEDFE", icon: "chat_optimize" },
  text2image: { color: "#378ADD", light: "#E6F1FB", icon: "text2image" },
  text2video: { color: "#BA7517", light: "#FAEEDA", icon: "text2video" },
  image2video: { color: "#D4537E", light: "#FBEAF0", icon: "image2video" },
  output: { color: "#639922", light: "#EAF3DE", icon: "output" },
}

const NodeIcons = {
  chat_optimize: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 2h12v9H5l-3 3V2z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
    </svg>
  ),
  text2image: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  text2video: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  image2video: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="6.5" y="7" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  ),
  output: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 2h10l-2 6H5L3 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
}

export default function NodePropertiesPanel({ node, updateNodeData, onDeleteNode }) {
  const { addPromptRecord } = useApp()

  const [localData, setLocalData] = useState({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState("")
  const syncTimer = useRef(null)

  // Sync local state when selected node changes
  useEffect(() => {
    if (node) {
      setLocalData({ ...node.data })
      if (node.data.resultType) {
        const rt = node.data.resultType
        if (rt === "text") {
          setResult({ type: "text", content: node.data.resultText || "" })
        } else if (rt === "image") {
          setResult({ type: "image", urls: node.data.resultUrls || [] })
        } else if (rt === "video") {
          setResult({ type: "video", url: node.data.resultUrl || "" })
        } else if (rt === "info") {
          setResult({ type: "info", content: node.data.resultInfo || "" })
        } else if (rt === "error") {
          setResult({ type: "error", content: node.data.resultError || "" })
        }
      } else {
        setResult(null)
      }
    }
  }, [node?.id])

  const queueSync = useCallback((key, value) => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      if (node && updateNodeData) {
        updateNodeData(node.id, { [key]: value })
      }
    }, 400)
  }, [node?.id, updateNodeData])

  const updateField = useCallback((key, value) => {
    setLocalData(prev => ({ ...prev, [key]: value }))
    queueSync(key, value)
  }, [queueSync])

  const updateFieldImmediate = useCallback((key, value) => {
    setLocalData(prev => ({ ...prev, [key]: value }))
    if (syncTimer.current) clearTimeout(syncTimer.current)
    if (node && updateNodeData) {
      updateNodeData(node.id, { [key]: value })
    }
  }, [node?.id, updateNodeData])

  useEffect(() => {
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current) }
  }, [])

  const handleRun = async () => {
    if (!node || running) return
    setRunning(true)
    setResult(null)
    setProgress(5)
    setProgressLabel("准备请求中...")

    try {
      let res
      const prompt = localData.prompt || ""

      switch (node.type) {
        case "chat_optimize": {
          const system = localData.systemPrompt || "你是一位专业的视频/图像生成提示词优化专家。"
          const model = localData.model || "agnes-2.0-flash"
          const msgs = [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ]
          setProgress(20)
          setProgressLabel("优化提示词中...")
          res = await chat(msgs, model)
          setProgress(70)
          setProgressLabel("处理结果中...")
          const reply = res.choices?.[0]?.message?.content || ""
          updateFieldImmediate("resultText", reply)
          updateFieldImmediate("resultType", "text")
          setResult({ type: "text", content: reply })
          addPromptRecord(prompt, reply)
          break
        }

        case "text2image": {
          const size = localData.size || "1024x1024"
          const n = localData.n || 1
          const model = localData.model || "agnes-image-2.1-flash"
          setProgress(15)
          setProgressLabel("请求图片生成中...")
          res = await generateImage(prompt, size, n, model)
          setProgress(70)
          setProgressLabel("保存图片到本地...")
          const urls = (res.data || []).map(d => d.url).filter(Boolean)
          if (urls.length > 0) {
            updateFieldImmediate("resultUrl", urls[0])
            updateFieldImmediate("resultUrls", urls)
            updateFieldImmediate("resultType", "image")
            setResult({ type: "image", urls })
          }
          break
        }

        case "text2video":
        case "image2video": {
          const imageUrl = localData.imageUrl || null
          const model = localData.model || "agnes-video-v2.0"
          const width = localData.width || ""
          const height = localData.height || ""
          setProgress(10)
          setProgressLabel("提交视频请求中...")
          res = await generateVideo(prompt, model, imageUrl, width, height, localData.num_frames, localData.frame_rate)
          if (res.status === "completed" && res.video_url) {
            setProgress(80)
            setProgressLabel("视频已生成")
            updateFieldImmediate("resultUrl", res.video_url)
            updateFieldImmediate("resultType", "video")
            setResult({ type: "video", url: res.video_url })
          } else if (res.video_id) {
            setProgress(60)
            setProgressLabel(`视频已排队 (${res.status})，轮询中...`)
            updateFieldImmediate("resultType", "info")
            updateFieldImmediate("resultInfo", `Video queued (${res.status})`)
            updateFieldImmediate("videoId", res.video_id)
            setResult({ type: "info", content: `视频已排队 (${res.status}), ID: ${res.video_id?.slice(0, 20)}...` })
          } else {
            setProgress(60)
            setProgressLabel(`视频状态: ${res.status}`)
            updateFieldImmediate("resultType", "info")
            updateFieldImmediate("resultInfo", `视频状态: ${res.status}`)
            setResult({ type: "info", content: `视频状态: ${res.status}` })
          }
          break
        }

        default:
          setResult({ type: "error", content: "未知节点类型" })
      }
      setProgress(100)
      setProgressLabel("完成")
    } catch (err) {
      updateFieldImmediate("resultType", "error")
      updateFieldImmediate("resultError", err.message)
      setResult({ type: "error", content: err.message })
      setProgressLabel(`Failed: ${err.message}`)
    } finally {
      setTimeout(() => {
        setRunning(false)
        setProgress(0)
        setProgressLabel("")
      }, 800)
    }
  }

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center"
           style={{ color: "var(--text-tertiary)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3, marginBottom: 12 }}>
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="9" cy="9" r="2" fill="currentColor" opacity="0.4"/>
          <path d="M3 17l4-5 3 3.5 3-3L21 17" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          选中节点后<br/>在此编辑属性
        </p>
      </div>
    )
  }

  const nc = NODE_COLORS[node.type] || NODE_COLORS.chat_optimize

  const nodeLabel = {
    chat_optimize: "提示词优化",
    text2image: "图片生成",
    text2video: "文生视频",
    image2video: "图生视频",
    output: "输出保存",
  }[node.type] || node.type

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: nc.light, color: nc.color }}
        >
          {NodeIcons[nc.icon]}
        </div>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {nodeLabel}
        </span>
        <span className="text-[9px] font-mono ml-auto" style={{ color: "var(--text-tertiary)" }}>
          {node.id?.slice(0, 8)}
        </span>
        <button onClick={() => onDeleteNode?.(node.id)}
          className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded transition-colors"
          style={{ color: "#E24B4A" }}>
          {SvgIcons.delete}
        </button>
      </div>

      {/* Prompt */}
      {node.type !== "output" && (
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Prompt
          </label>
          <textarea
            value={localData.prompt || ""}
            onChange={e => updateField("prompt", e.target.value)}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-xs resize-none transition-colors"
            style={{
              background: "var(--bg-surface-hover)",
              border: "1px solid var(--border-light)",
              color: "var(--text-primary)",
            }}
            placeholder="输入提示词..."
          />
        </div>
      )}

      {/* System prompt */}
      {node.type === "chat_optimize" && (
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            System Prompt
          </label>
          <textarea
            value={localData.systemPrompt || ""}
            onChange={e => updateField("systemPrompt", e.target.value)}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-xs resize-none transition-colors"
            style={{
              background: "var(--bg-surface-hover)",
              border: "1px solid var(--border-light)",
              color: "var(--text-primary)",
            }}
            placeholder="设置系统提示词..."
          />
        </div>
      )}

      {/* Image URL for image2video */}
      {node.type === "image2video" && (
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Reference Image URL
          </label>
          <input
            value={localData.imageUrl || ""}
            onChange={e => updateField("imageUrl", e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-xs transition-colors"
            style={{
              background: "var(--bg-surface-hover)",
              border: "1px solid var(--border-light)",
              color: "var(--text-primary)",
            }}
            placeholder="https://example.com/image.jpg"
          />
        </div>
      )}

      {/* Model Selector */}
      {(node.type === "chat_optimize" || node.type === "text2image" || node.type === "text2video" || node.type === "image2video") && (
        <div>
          <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            模型
          </label>
          <select
            value={localData.model || ""}
            onChange={e => updateFieldImmediate("model", e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-xs transition-colors"
            style={{
              background: "var(--bg-surface-hover)",
              border: "1px solid var(--border-light)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">默认模型</option>
            {(MODELS[node.type] || []).map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Image Size & Count */}
      {node.type === "text2image" && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              尺寸（必须是 16 的倍数）
            </label>
            <select
              value={localData.size || "1024x1024"}
              onChange={e => updateFieldImmediate("size", e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs transition-colors"
              style={{
                background: "var(--bg-surface-hover)",
                border: "1px solid var(--border-light)",
                color: "var(--text-primary)",
              }}
            >
              <optgroup label="1:1 正方形">
                <option value="512x512">512x512</option>
                <option value="1024x1024">1024x1024</option>
              </optgroup>
              <optgroup label="16:9 横屏">
                <option value="1280x720">1280x720 (720p)</option>
                <option value="1920x1080">1920x1080 (1080p)</option>
              </optgroup>
            <optgroup label="9:16 竖屏">
              <option value="720x1280">720x1280</option>
              <option value="1080x1920">1080x1920</option>
            </optgroup>
            </select>
          </div>
          <div className="w-20">
            <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              数量
            </label>
            <input type="number" min={1} max={4}
              value={localData.n || 1}
              onChange={e => updateFieldImmediate("n", Math.min(4, Math.max(1, +e.target.value)))}
              className="w-full rounded-lg px-3 py-2 text-xs text-center transition-colors"
              style={{
                background: "var(--bg-surface-hover)",
                border: "1px solid var(--border-light)",
                color: "var(--text-primary)",
              }} />
          </div>
        </div>
      )}

      {/* Video Resolution + Duration */}
      {(node.type === "text2video" || node.type === "image2video") && (
        <>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                分辨率（必须是 64 的倍数）
              </label>
              <select
                value={`${localData.width || ""}x${localData.height || ""}`}
                onChange={e => {
                  const [w, h] = e.target.value.split("x")
                  updateFieldImmediate("width", +w)
                  updateFieldImmediate("height", +h)
                }}
                className="w-full rounded-lg px-3 py-2 text-xs transition-colors"
                style={{
                  background: "var(--bg-surface-hover)",
                  border: "1px solid var(--border-light)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="x">默认 (1152x768)</option>
                <optgroup label="1:1 正方形">
                  <option value="640x640">640x640</option>
                  <option value="1024x1024">1024x1024</option>
                </optgroup>
                <optgroup label="16:9 横屏">
                  <option value="1024x576">1024x576</option>
                  <option value="1152x640">1152x640</option>
                  <option value="1280x704">1280x704</option>
                  <option value="1920x1088">1920x1088</option>
                </optgroup>
                <optgroup label="3:2 横屏">
                  <option value="1152x768">1152x768 (default)</option>
                  <option value="1536x1024">1536x1024</option>
                </optgroup>
                <optgroup label="9:16 竖屏">
                  <option value="640x1152">640x1152</option>
                  <option value="704x1280">704x1280</option>
                </optgroup>
              </select>
              {localData.width && localData.height && (
                <p className="text-[9px] mt-0.5" style={{ color: nc.color }}>
                  {Math.round((localData.width / localData.height) * 100) / 100}:1 · W{localData.width % 64 === 0 ? "✓" : "✗"} H{localData.height % 64 === 0 ? "✓" : "✗"}
                </p>
              )}
            </div>
          </div>

          {/* Frame count + frame rate */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                帧数
              </label>
              <select
                value={localData.num_frames || ""}
                onChange={e => updateFieldImmediate("num_frames", e.target.value ? +e.target.value : "")}
                className="w-full rounded-lg px-3 py-2 text-xs transition-colors"
                style={{
                  background: "var(--bg-surface-hover)",
                  border: "1px solid var(--border-light)",
                  color: "var(--text-primary)",
                }}
              >
                {(() => {
                  const fr = localData.frame_rate
                  const allOptions = [
                    { value: 81, label: "81 frames" },
                    { value: 121, label: "121 frames" },
                    { value: 241, label: "241 frames" },
                    { value: 441, label: "441 frames" },
                  ]
                  if (!fr) {
                    return [<option key="" value="">默认</option>,
                      ...allOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)]
                  }
                  const maxSeconds = fr === 24 ? 15 : fr === 30 ? 10 : fr === 60 ? 5 : 30
                  const maxFrames = fr * maxSeconds
                  const valid = allOptions.filter(o => o.value <= maxFrames && o.value <= 441)
                  if (localData.num_frames && localData.num_frames > maxFrames) {
                    setTimeout(() => updateFieldImmediate("num_frames", valid.length > 0 ? valid[valid.length - 1].value : ""), 0)
                  }
                  return [<option key="" value="">默认</option>,
                    ...valid.map(o => {
                      const secs = Math.round(o.value / fr)
                      return <option key={o.value} value={o.value}>~{secs}s ({o.label})</option>
                    }),
                    valid.length < allOptions.length && <option key="__disabled" value="" disabled>···</option>,
                    ...allOptions.filter(o => o.value > maxFrames).map(o => {
                      const secs = Math.round(o.value / fr)
                      return <option key={o.value} value={o.value} disabled>Exceeds {secs}s limit ({o.label})</option>
                    })]
                })()}
              </select>
              {localData.frame_rate && localData.num_frames && (
                <p className="text-[9px] mt-0.5" style={{ color: nc.color }}>
                  ~{Math.round(localData.num_frames / localData.frame_rate)}s
                </p>
              )}
              {!localData.frame_rate && (
                <p className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  帧数必须满足 8n+1，最多 441 帧
                </p>
              )}
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                帧率
              </label>
              <select
                value={localData.frame_rate || ""}
                onChange={e => {
                  const fr = e.target.value ? +e.target.value : ""
                  updateFieldImmediate("frame_rate", fr)
                  if (fr) {
                    const maxSeconds = fr === 24 ? 15 : fr === 30 ? 10 : fr === 60 ? 5 : 30
                    const maxFrames = fr * maxSeconds
                    if (localData.num_frames && localData.num_frames > maxFrames) {
                      const validFrames = [441, 241, 121, 81].filter(v => v <= maxFrames)
                      updateFieldImmediate("num_frames", validFrames[0] || "")
                    }
                  }
                }}
                className="w-full rounded-lg px-3 py-2 text-xs transition-colors"
                style={{
                  background: "var(--bg-surface-hover)",
                  border: "1px solid var(--border-light)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">默认</option>
                <option value={24}>24 fps (&le;15s)</option>
                <option value={30}>30 fps (&le;10s)</option>
                <option value={60}>60 fps (&le;5s)</option>
              </select>
              {localData.frame_rate && (
                <p className="text-[9px] mt-1" style={{ color: nc.color }}>
                  Max {localData.frame_rate === 24 ? "15" : localData.frame_rate === 30 ? "10" : "5"}s
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Output config */}
      {node.type === "output" && (
        <>
          <div>
            <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              保存格式
            </label>
            <select
              value={localData.format || "auto"}
              onChange={e => updateFieldImmediate("format", e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs transition-colors"
              style={{
                background: "var(--bg-surface-hover)",
                border: "1px solid var(--border-light)",
                color: "var(--text-primary)",
              }}
            >
              <option value="auto">自动</option>
              <option value="mp4">MP4</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
          </div>
          {/* Show received upstream data */}
          {(localData.resultType || localData.resultInfo) && (
            <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--border-light)" }}>
              <p className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                已接收数据
              </p>
              {localData.resultType && (
                <p className="text-[10px]" style={{ color: nc.color }}>type: {localData.resultType}</p>
              )}
              {localData.resultInfo && (
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{localData.resultInfo}</p>
              )}
              {localData.resultUrl && (
                <div className="mt-1 space-y-1">
                  {localData.resultType === "video" ? (
                    <video src={localData.resultUrl} controls
                      className="w-full max-h-48 object-contain rounded-lg"
                      style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-light)" }} />
                  ) : localData.resultType === "image" ? (
                    (localData.resultUrls?.length > 1 ? localData.resultUrls : [localData.resultUrl]).map((url, i) => (
                      <img key={i} src={url} alt=""
                        className="w-full max-h-48 object-contain rounded-lg"
                        style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-light)" }} />
                    ))
                  ) : null}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Run button */}
      {node.type !== "output" && (
        <button
          onClick={handleRun}
          disabled={running || !localData.prompt}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors relative overflow-hidden disabled:opacity-40"
          style={{
            background: nc.color,
            color: "#fff",
          }}
        >
          {running && (
            <span className="absolute inset-0" style={{ background: "rgba(255,255,255,0.15)", width: `${Math.max(progress, 5)}%` }} />
          )}
          {running ? `${progress}%` : <>{SvgIcons.play} 执行节点</>}
        </button>
      )}

      {/* Progress */}
      {running && progress > 0 && (
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-light)" }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: nc.color,
              }}
            />
          </div>
          <p className="text-[10px] text-center" style={{ color: "var(--text-tertiary)" }}>
            {progressLabel}
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="pt-3 space-y-2" style={{ borderTop: "1px solid var(--border-light)" }}>
          <p className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>
          执行结果
          </p>
          {result.type === "text" && (
            <p className="text-[11px] whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto"
               style={{ color: "var(--text-primary)" }}>
              {result.content}
            </p>
          )}
          {result.type === "image" && result.urls?.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt=""
                className="w-full max-h-48 object-contain rounded-lg"
                style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-light)" }} />
            </a>
          ))}
          {result.type === "video" && (
            <video src={result.url} controls
              className="w-full max-h-48 object-contain rounded-lg"
              style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-light)" }} />
          )}
          {result.type === "info" && (
            <p className="text-[11px]" style={{ color: "#BA7517" }}>{result.content}</p>
          )}
          {result.type === "error" && (
            <p className="text-[11px]" style={{ color: "#E24B4A" }}>{result.content}</p>
          )}
        </div>
      )}
    </div>
  )
}
