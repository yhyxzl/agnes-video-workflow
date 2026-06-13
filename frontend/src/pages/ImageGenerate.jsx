import React, { useState, useRef, useEffect } from "react"
import { generateImage } from "../store/api"
import { useApp } from "../store/AppContext"

const SIZES = ["512x512", "1024x1024", "1280x720", "720x1280"]

/* ── 图片浮窗组件 ── */
function ImageFloatingWindow({ images, onClose }) {
  const [positions, setPositions] = useState(() =>
    images.map((_, i) => ({ x: 40 + i * 30, y: 60 + i * 30 }))
  )
  const [dragging, setDragging] = useState({ index: -1, startX: 0, startY: 0, offsetX: 0, offsetY: 0 })
  const [copiedIndex, setCopiedIndex] = useState(-1)
  const [visible, setVisible] = useState(true)
  const winRef = useRef(null)

  // 动画入场
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleMouseDown = (e, index) => {
    e.preventDefault()
    setDragging({
      index,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: positions[index].x,
      offsetY: positions[index].y,
    })
  }

  const handleMouseMove = (e) => {
    if (dragging.index < 0) return
    const newPositions = [...positions]
    newPositions[dragging.index] = {
      x: dragging.offsetX + (e.clientX - dragging.startX),
      y: dragging.offsetY + (e.clientY - dragging.startY),
    }
    setPositions(newPositions)
  }

  const handleMouseUp = () => {
    setDragging({ index: -1, startX: 0, startY: 0, offsetX: 0, offsetY: 0 })
  }

  const copyUrl = async (url, index) => {
    try {
      await navigator.clipboard.writeText(window.location.origin + url)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(-1), 2000)
    } catch {
      // 降级方案
      const textarea = document.createElement("textarea")
      textarea.value = window.location.origin + url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(-1), 2000)
    }
  }

  // 获取图片的本地URL（优先用修订后的版本）
  const getImageUrl = (img) => {
    if (img.local_url) return img.local_url
    const revisedUrl = img.url?.startsWith("/api/download/")
    if (revisedUrl) return img.url
    return img.url
  }

  if (images.length === 0) return null

  return (
    <>
      {/* 阻隔层 */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        style={{ animation: "fadeIn 0.2s ease" }}
        onClick={onClose}
      />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* 浮窗 */}
      <div
        ref={winRef}
        className="fixed z-50"
        style={{
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {images.map((img, i) => {
          // 优先使用本地 URL 显示，否则用远程 URL
          const displayUrl = img.local_url || img.url
          const copyUrlValue = img.local_url || img.url
          const pos = positions[i] || { x: 60 + i * 40, y: 80 + i * 40 }
          const isDragging = dragging.index === i

          return (
            <div
              key={i}
              className="absolute bg-white dark:bg-[#242422] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#3A3A37] overflow-hidden"
              style={{
                left: pos.x,
                top: pos.y,
                width: 420,
                pointerEvents: "auto",
                cursor: isDragging ? "grabbing" : "default",
                transition: isDragging ? "none" : "box-shadow 0.2s",
                animation: `slideUp 0.3s ease ${i * 0.1}s both`,
                zIndex: isDragging ? 100 : 50 + i,
              }}
            >
              {/* 标题栏（拖动把手） */}
              <div
                className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-[#1E1E1C] cursor-grab active:cursor-grabbing select-none border-b border-gray-100 dark:border-[#3A3A37]"
                onMouseDown={(e) => handleMouseDown(e, i)}
              >
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  生成图片 #{i + 1}
                </span>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-0.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 图片预览 */}
              <div className="bg-gray-100 dark:bg-[#1A1A18] flex items-center justify-center">
                {displayUrl ? (
                  <img
                    src={displayUrl}
                    alt=""
                    className="w-full max-h-64 object-contain"
                    style={{ imageRendering: "auto" }}
                  />
                ) : img.b64_json ? (
                  <img
                    src={"data:image/png;base64," + img.b64_json}
                    alt=""
                    className="w-full max-h-64 object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">无数据</div>
                )}
              </div>

              {/* URL + 复制按钮 */}
              <div className="p-4 space-y-2">
                {img.revised_prompt && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                    {img.revised_prompt}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1">图片 URL</label>
                    <div className="flex items-center bg-gray-50 dark:bg-[#1E1E1C] rounded-lg border border-gray-200 dark:border-[#3A3A37] overflow-hidden">
                      <input
                        type="text"
                        readOnly
                        value={copyUrlValue || ""}
                        className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-300 px-3 py-2 outline-none min-w-0 font-mono"
                        onClick={(e) => e.target.select()}
                      />
                      <button
                        onClick={() => copyUrl(copyUrlValue, i)}
                        className={`shrink-0 px-3 py-2 text-xs font-medium transition-colors border-l border-gray-200 dark:border-[#3A3A37] ${
                          copiedIndex === i
                            ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                            : "bg-gray-50 dark:bg-[#1E1E1C] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2A]"
                        }`}
                      >
                        {copiedIndex === i ? "已复制 ✓" : "复制"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-1">
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-center text-xs bg-gray-100 dark:bg-[#2C2C2A] hover:bg-gray-200 dark:hover:bg-[#3A3A37] text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition-colors"
                  >
                    新标签页打开
                  </a>
                  <button
                    onClick={() => {
                      const link = document.createElement("a")
                      link.href = displayUrl
                      link.download = displayUrl.split("/").pop() || "image.png"
                      link.click()
                    }}
                    className="flex-1 text-center text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    下载图片
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}


/* ── 图片生成页面主组件 ── */
export default function ImageGenerate() {
  const { promptHistory, imageHistory, addImageRecord, clearImageHistory } = useApp()

  const [prompt, setPrompt] = useState("")
  const [size, setSize] = useState("1024x1024")
  const [n, setN] = useState(1)
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState([])
  const [showFloating, setShowFloating] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setImages([])
    setShowFloating(false)
    try {
      const res = await generateImage(prompt.trim(), size, n)
      const data = res.data || []
      setImages(data)
      // 生成成功后自动弹出浮窗
      if (data.length > 0) {
        setShowFloating(true)
      }
      // Save to image history
      data.forEach(item => {
        if (item.url) addImageRecord(prompt.trim(), item.url, size)
      })
    } catch (err) {
      alert("生成失败: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fillPrompt = (text) => {
    setPrompt(text)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dark-100 mb-1">图片生成</h2>
        <p className="text-dark-500 text-sm">使用 Agnes 图像模型生成高质量图片，提示词记录持久保存</p>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-dark-400 mb-1.5">提示词</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500 text-dark-200 placeholder-dark-500 resize-none"
            placeholder="描述你想要生成的图片内容..."
          />
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-dark-400 mb-1.5">尺寸</label>
            <select value={size} onChange={e => setSize(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-dark-200">
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-dark-400 mb-1.5">数量</label>
            <input type="number" min={1} max={4} value={n}
              onChange={e => setN(Math.min(4, Math.max(1, +e.target.value)))}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-dark-200 text-center" />
          </div>
          <button onClick={handleGenerate} disabled={loading || !prompt.trim()}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-6 py-2.5 rounded-lg text-sm font-medium">
            {loading ? "生成中..." : "生成图片"}
          </button>
        </div>

        {/* ── 优化提示词快速引用 ── */}
        {promptHistory.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-dark-400 mb-1.5">最近优化提示词（点击填充）</label>
            <div className="flex flex-wrap gap-1.5">
              {promptHistory.slice(0, 10).map(r => (
                <button
                  key={r.id}
                  onClick={() => fillPrompt(r.optimized.slice(0, 200))}
                  className="text-[11px] bg-dark-700 hover:bg-brand-600/20 text-dark-400 hover:text-brand-300 px-2.5 py-1 rounded border border-dark-600 hover:border-brand-600/30 transition-colors truncate max-w-[250px]"
                  title={r.optimized}
                >
                  {r.original.slice(0, 20)}{r.original.length > 20 ? "..." : ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 当前生成结果（浮窗模式，不显示 grid） ── */}
      {images.length > 0 && !showFloating && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img, i) => (
            <div key={i} className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
              {img.url ? (
                <a href={img.url} target="_blank" rel="noreferrer">
                  <img src={img.url} alt="" className="w-full aspect-square object-cover" />
                </a>
              ) : img.b64_json ? (
                <img src={"data:image/png;base64," + img.b64_json} alt="" className="w-full aspect-square object-cover" />
              ) : (
                <div className="flex items-center justify-center h-48 bg-dark-700 text-dark-500 text-sm">无数据</div>
              )}
              <div className="p-3">
                {img.revised_prompt && <p className="text-xs text-dark-400 line-clamp-2">{img.revised_prompt}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 浮窗显示 ── */}
      {showFloating && <ImageFloatingWindow images={images} onClose={() => setShowFloating(false)} />}

      {/* ── 图片历史记录 ── */}
      {imageHistory.length > 0 && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-brand-400">生成历史 ({imageHistory.length})</h3>
            <button
              onClick={clearImageHistory}
              className="text-xs text-dark-500 hover:text-red-400 transition-colors"
            >
              清空全部
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {imageHistory.map(rec => (
              <div key={rec.id} className="group relative bg-dark-700 rounded-lg overflow-hidden border border-dark-600">
                <a href={rec.url} target="_blank" rel="noreferrer">
                  <img src={rec.url} alt="" className="w-full aspect-square object-cover" />
                </a>
                <div className="p-2">
                  <p className="text-[10px] text-dark-400 line-clamp-1">{rec.prompt}</p>
                  <p className="text-[9px] text-dark-500 mt-0.5">{rec.createdAt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
