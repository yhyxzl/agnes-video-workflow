import React, { useState, useEffect } from "react"
import { listOutputs } from "../store/api"

export default function OutputGallery() {
  const [outputs, setOutputs] = useState([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listOutputs().then(setOutputs).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = filter === "all" ? outputs : outputs.filter(o => o.type === filter)
  const hasImages = outputs.some(o => o.type === "image")
  const hasVideos = outputs.some(o => o.type === "video")

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-100 mb-1">输出管理</h2>
          <p className="text-dark-500 text-sm">查看和管理所有生成的输出</p>
        </div>
        <button onClick={() => { setLoading(true); listOutputs().then(setOutputs).finally(() => setLoading(false)) }}
          className="bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg px-4 py-2 text-sm text-dark-300">
          刷新
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button onClick={() => setFilter("all")} className={
          "px-3 py-1.5 rounded-lg text-xs font-medium " +
          (filter === "all" ? "bg-brand-600 text-white" : "bg-dark-700 text-dark-400 hover:text-dark-300")
        }>全部 ({outputs.length})</button>
        {hasImages && (
          <button onClick={() => setFilter("image")} className={
            "px-3 py-1.5 rounded-lg text-xs font-medium " +
            (filter === "image" ? "bg-brand-600 text-white" : "bg-dark-700 text-dark-400 hover:text-dark-300")
          }>图片 ({outputs.filter(o => o.type === "image").length})</button>
        )}
        {hasVideos && (
          <button onClick={() => setFilter("video")} className={
            "px-3 py-1.5 rounded-lg text-xs font-medium " +
            (filter === "video" ? "bg-brand-600 text-white" : "bg-dark-700 text-dark-400 hover:text-dark-300")
          }>视频 ({outputs.filter(o => o.type === "video").length})</button>
        )}
      </div>

      {/* Grid */}
      {loading && <p className="text-dark-500 text-sm">加载中...</p>}
      {!loading && filtered.length === 0 && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-12 text-center text-dark-600">
          暂无输出文件
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(item => (
          <div key={item.id} className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden group">
            {item.type === "video" ? (
              <video src={item.url} className="w-full aspect-video object-cover" controls />
            ) : (
              <img src={item.url} alt="" className="w-full aspect-square object-cover" />
            )}
            <div className="p-3">
              <div className="flex items-center justify-between">
                <span className={"text-xs px-2 py-0.5 rounded " + (item.type === "video" ? "bg-purple-900 text-purple-300" : "bg-blue-900 text-blue-300")}>
                  {item.type}
                </span>
                <span className="text-xs text-dark-600">{formatSize(item.size || 0)}</span>
              </div>
              <p className="text-xs text-dark-500 mt-1">{item.created_at}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
