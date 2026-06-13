import React, { useState, useEffect, useRef } from "react"
import { generateVideo, getVideoStatus, uploadImage } from "../store/api"
import { useApp } from "../store/AppContext"

const ACCEPTED_IMAGE_TYPES = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]

export default function VideoGenerate() {
  const { promptHistory, imageHistory, videoHistory, addVideoRecord, updateVideoRecord, clearVideoHistory } = useApp()

  const [prompt, setPrompt] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [useImage, setUseImage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentResult, setCurrentResult] = useState(null)
  const pollTimer = useRef(null)

  // ── 本地文件上传状态 ──
  const [localFile, setLocalFile] = useState(null)     // 选中的本地文件
  const [localPreview, setLocalPreview] = useState("")  // 本地预览 URL
  const [uploading, setUploading] = useState(false)
  const [uploadSource, setUploadSource] = useState("url") // "url" | "local"
  const fileInputRef = useRef(null)

  // ── 清理轮询定时器 ──
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
      // 清理预览 URL
      if (localPreview && localPreview.startsWith("blob:")) {
        URL.revokeObjectURL(localPreview)
      }
    }
  }, [localPreview])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 验证格式
    const ext = "." + file.name.split(".").pop().toLowerCase()
    if (!ACCEPTED_IMAGE_TYPES.includes(ext)) {
      alert(`不支持的图片格式: ${ext}，支持: ${ACCEPTED_IMAGE_TYPES.join(", ")}`)
      return
    }
    // 验证大小（最大 20MB）
    if (file.size > 20 * 1024 * 1024) {
      alert("图片不能超过 20MB")
      return
    }
    // 清理旧预览
    if (localPreview && localPreview.startsWith("blob:")) {
      URL.revokeObjectURL(localPreview)
    }
    setLocalFile(file)
    setLocalPreview(URL.createObjectURL(file))
    setUploadSource("local")
  }

  const handleUploadLocalImage = async () => {
    if (!localFile) return
    setUploading(true)
    try {
      const res = await uploadImage(localFile)
      setImageUrl(res.url)
      alert("图片上传成功！已自动填入图片来源")
    } catch (err) {
      alert("上传失败: " + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setCurrentResult(null)

    try {
      // 如果选了本地文件但还没上传，先上传
      let finalImageUrl = imageUrl.trim()
      if (uploadSource === "local" && localFile && !finalImageUrl) {
        try {
          const uploadRes = await uploadImage(localFile)
          finalImageUrl = uploadRes.url
          setImageUrl(finalImageUrl)
        } catch (uploadErr) {
          setCurrentResult({ status: "error", message: "图片上传失败: " + uploadErr.message })
          setLoading(false)
          return
        }
      }

      const imgUrl = useImage ? finalImageUrl : null
      const res = await generateVideo(prompt.trim(), "agnes-video-v2.0", imgUrl)

      const record = addVideoRecord(prompt.trim(), imgUrl, res.video_id, res.status)
      setCurrentResult({ ...res, recordId: record.id })

      // ── 如果 queued/progress，用 video_id 轮询 ──
      if ((res.status === "queued" || res.status === "in_progress" || res.status === "pending") && res.video_id) {
        let attempts = 0
        const videoId = res.video_id
        const maxAttempts = 60
        pollTimer.current = setInterval(async () => {
          attempts++
          try {
            const statusRes = await getVideoStatus(videoId)
            updateVideoRecord(record.id, { status: statusRes.status })
            setCurrentResult(prev => ({ ...prev, status: statusRes.status, pollProgress: statusRes.progress || Math.min(10 + attempts * 5, 85) }))
            if (statusRes.status === "completed" && statusRes.video_url) {
              clearInterval(pollTimer.current)
              updateVideoRecord(record.id, { status: "completed", videoUrl: statusRes.video_url })
              setCurrentResult(prev => ({ ...prev, status: "completed", video_url: statusRes.video_url, pollProgress: 100 }))
            } else if (statusRes.status === "failed") {
              clearInterval(pollTimer.current)
              updateVideoRecord(record.id, { status: "failed" })
              setCurrentResult(prev => ({ ...prev, status: "failed", message: statusRes.message }))
            }
          } catch {
            // 轮询失败继续重试
          }
          if (attempts >= maxAttempts) {
            clearInterval(pollTimer.current)
            updateVideoRecord(record.id, { status: "timeout" })
            setCurrentResult(prev => ({ ...prev, status: "timeout" }))
          }
        }, 5000)
      } else if (res.status === "completed" && res.video_url) {
        updateVideoRecord(record.id, { status: "completed", videoUrl: res.video_url })
        setCurrentResult(prev => ({ ...prev, status: "completed", video_url: res.video_url }))
      }
    } catch (err) {
      setCurrentResult({ status: "error", message: err.message })
    } finally {
      setLoading(false)
    }
  }

  const fillPrompt = (text) => {
    setPrompt(text)
  }

  const fillImage = (url) => {
    setImageUrl(url)
    setUseImage(true)
    setUploadSource("url")
    setLocalFile(null)
    if (localPreview && localPreview.startsWith("blob:")) {
      URL.revokeObjectURL(localPreview)
    }
    setLocalPreview("")
  }

  // 从图片历史中提取最近可用图片
  const recentImages = imageHistory.filter(r => r.url).slice(0, 8)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dark-100 mb-1">视频生成</h2>
        <p className="text-dark-500 text-sm">使用 Agnes 视频模型生成 AI 视频，支持文生视频和图生视频</p>
      </div>

      {/* ── 输入区 ── */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-dark-400 mb-1.5">提示词</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500 text-dark-200 placeholder-dark-500 resize-none"
            placeholder="描述你想要生成的视频内容..."
          />
        </div>

        {/* 图生视频切换 */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useImage}
              onChange={e => {
                setUseImage(e.target.checked)
                if (!e.target.checked) {
                  setUploadSource("url")
                }
              }}
              className="rounded bg-dark-700 border-dark-600 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-xs text-dark-400">图生视频（提供参考图片）</span>
          </label>
        </div>

        {useImage && (
          <div className="space-y-3">
            {/* 图片来源切换标签 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setUploadSource("url"); setLocalFile(null); if (localPreview) URL.revokeObjectURL(localPreview); setLocalPreview("") }}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  uploadSource === "url"
                    ? "bg-brand-600 text-white"
                    : "bg-dark-700 text-dark-400 hover:text-dark-200"
                }`}
              >
                URL 输入
              </button>
              <button
                onClick={() => setUploadSource("local")}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  uploadSource === "local"
                    ? "bg-brand-600 text-white"
                    : "bg-dark-700 text-dark-400 hover:text-dark-200"
                }`}
              >
                本地上传
              </button>
            </div>

            {/* URL 输入模式 */}
            {uploadSource === "url" && (
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1.5">图片 URL</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-dark-200 placeholder-dark-500"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            )}

            {/* 本地文件上传模式 */}
            {uploadSource === "local" && (
              <div>
                <label className="block text-xs font-medium text-dark-400 mb-1.5">选择图片文件</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-dark-700 hover:bg-dark-600 border border-dark-600 text-dark-300 px-4 py-2.5 rounded-lg text-sm transition-colors"
                  >
                    选择文件...
                  </button>
                  {localFile && (
                    <span className="text-xs text-dark-400 truncate max-w-[200px]">
                      {localFile.name}
                    </span>
                  )}
                  {localFile && !imageUrl && (
                    <button
                      onClick={handleUploadLocalImage}
                      disabled={uploading}
                      className="text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                      {uploading ? "上传中..." : "上传图片"}
                    </button>
                  )}
                </div>

                {/* 本地图片预览 */}
                {localPreview && (
                  <div className="mt-3">
                    <div className="relative inline-block rounded-lg overflow-hidden border border-dark-600">
                      <img
                        src={localPreview}
                        alt="预览"
                        className="max-h-40 max-w-full object-contain"
                      />
                      {imageUrl && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-600/80 text-white text-[10px] rounded">
                          已上传
                        </div>
                      )}
                    </div>
                    {imageUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] text-dark-500 font-mono truncate max-w-[300px]">
                          {imageUrl}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(imageUrl)}
                          className="text-[10px] text-brand-400 hover:text-brand-300 shrink-0"
                        >
                          复制
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-4 items-end">
          <button onClick={handleGenerate} disabled={loading || !prompt.trim() || (useImage && uploadSource === "url" && !imageUrl.trim())}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-6 py-2.5 rounded-lg text-sm font-medium">
            {loading ? "提交中..." : "生成视频"}
          </button>
          {loading && (
            <span className="text-xs text-dark-400 animate-pulse">正在请求 AI 模型...</span>
          )}
        </div>

        {/* ── 优化提示词快速引用 ── */}
        {promptHistory.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-dark-400 mb-1.5">优化提示词（点击填充）</label>
            <div className="flex flex-wrap gap-1.5">
              {promptHistory.slice(0, 8).map(r => (
                <button
                  key={r.id}
                  onClick={() => fillPrompt(r.optimized.slice(0, 200))}
                  className="text-[11px] bg-dark-700 hover:bg-brand-600/20 text-dark-400 hover:text-brand-300 px-2.5 py-1 rounded border border-dark-600 hover:border-brand-600/30 transition-colors truncate max-w-[220px]"
                  title={r.optimized}
                >
                  {r.original.slice(0, 18)}{r.original.length > 18 ? "..." : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 图片历史快速引用（仅 URL 模式） ── */}
        {useImage && uploadSource === "url" && recentImages.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-dark-400 mb-1.5">最近生成的图片（点击填入 URL）</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentImages.map(img => (
                <button
                  key={img.id}
                  onClick={() => fillImage(img.url)}
                  className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-dark-600 hover:border-brand-500 transition-colors"
                  title={img.prompt}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 当前结果 ── */}
      {currentResult && (
        <div className={`rounded-xl border p-5 ${
          currentResult.status === "completed"
            ? "bg-dark-800 border-brand-600/40"
            : currentResult.status === "error" || currentResult.status === "timeout"
            ? "bg-dark-800 border-red-600/40"
            : "bg-dark-800 border-dark-600"
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${
              currentResult.status === "completed" ? "bg-green-500"
              : currentResult.status === "error" || currentResult.status === "timeout" ? "bg-red-500"
              : "bg-yellow-500 animate-pulse"
            }`}></span>
            <span className="text-sm font-medium text-dark-200">
              {currentResult.status === "completed" ? "生成完成"
              : currentResult.status === "queued" ? "已加入队列"
              : currentResult.status === "processing" ? "正在处理..."
              : currentResult.status === "timeout" ? "处理超时"
              : currentResult.status === "error" ? "生成失败"
              : currentResult.status}
            </span>
            {currentResult.video_id && (
              <span className="text-[10px] text-dark-500 font-mono ml-auto">
                ID: {currentResult.video_id.slice(0, 20)}...
              </span>
            )}
          </div>

          {/* 视频播放器 */}
          {currentResult.video_url && (
            <div className="aspect-video bg-dark-900 rounded-lg overflow-hidden">
              <video
                src={currentResult.video_url}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>
          )}

          {currentResult.status === "queued" && (
            <div className="bg-dark-700 rounded-lg p-4">
              <div className="flex justify-center gap-1 mb-3">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
              <div className="h-2 bg-dark-600 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all duration-1000"
                  style={{ width: `${currentResult.pollProgress || 10}%` }}
                />
              </div>
              <p className="text-xs text-dark-400 text-center">视频已加入生成队列，后台处理中...</p>
              <p className="text-[10px] text-dark-500 text-center mt-1">
                {currentResult.pollProgress || 0}% · 完成后自动保存到本地
              </p>
            </div>
          )}

          {currentResult.status === "error" && (
            <p className="text-xs text-red-400">{currentResult.message || "未知错误"}</p>
          )}

          {currentResult.video_url && (
            <div className="mt-3 flex gap-2">
              <a
                href={currentResult.video_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded transition-colors"
              >
                打开视频
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(currentResult.video_url)}
                className="text-xs bg-dark-700 hover:bg-dark-600 text-dark-300 px-4 py-1.5 rounded border border-dark-600 transition-colors"
              >
                复制链接
              </button>
              {currentResult.video_url && (
                <a
                  href={currentResult.video_url}
                  download
                  className="text-xs bg-green-700 hover:bg-green-600 text-white px-4 py-1.5 rounded transition-colors"
                >
                  下载视频
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 视频历史 ── */}
      {videoHistory.length > 0 && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-brand-400">生成历史 ({videoHistory.length})</h3>
            <button onClick={clearVideoHistory} className="text-xs text-dark-500 hover:text-red-400 transition-colors">
              清空全部
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {videoHistory.map(rec => (
              <div key={rec.id} className="bg-dark-700 rounded-lg border border-dark-600 overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      rec.status === "completed" ? "bg-green-500"
                      : rec.status === "timeout" || rec.status === "failed" || rec.status === "error" ? "bg-red-500"
                      : "bg-yellow-500 animate-pulse"
                    }`}></span>
                    <span className={`text-[10px] font-medium ${
                      rec.status === "completed" ? "text-green-400"
                      : rec.status === "error" || rec.status === "timeout" ? "text-red-400"
                      : "text-yellow-400"
                    }`}>
                      {rec.status === "completed" ? "已完成"
                      : rec.status === "queued" ? "已排队"
                      : rec.status === "processing" ? "处理中"
                      : rec.status === "timeout" ? "超时"
                      : rec.status === "error" ? "失败"
                      : rec.status}
                    </span>
                    <span className="text-[9px] text-dark-500 ml-auto">{rec.createdAt}</span>
                  </div>
                  <p className="text-[11px] text-dark-400 line-clamp-2 mb-2">{rec.prompt}</p>
                  {rec.videoUrl && (
                    <a
                      href={rec.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-[10px] text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      查看视频 →
                    </a>
                  )}
                  {!rec.videoUrl && (
                    <span className="text-[10px] text-dark-500">暂无结果</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
