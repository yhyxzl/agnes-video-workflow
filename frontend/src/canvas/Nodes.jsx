import { memo, useCallback } from "react"
import { Handle, Position, useReactFlow } from "@xyflow/react"

/* ─── SVG Icons ─── */
const icons = {
  chat_optimize: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 2h12v9H5l-3 3V2z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round"/>
      <path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  text2image: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" opacity="0.6"/>
      <path d="M2 12l3-4 2.5 3 2-2.5L14 12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  ),
  text2video: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M6.5 6l4 2-4 2V6z" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  image2video: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="6.5" y="7" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M9.5 9.5l3 1.5-3 1.5V9.5z" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  output: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 2h10l-2 6H5L3 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M5 8v3h6V8M8 8v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
}

const NODE_STYLES = {
  chat_optimize: { color: "#7F77DD", light: "#EEEDFE", label: "提示词优化", badge: "LLM" },
  text2image:    { color: "#378ADD", light: "#E6F1FB", label: "图片生成", badge: "SD" },
  text2video:    { color: "#BA7517", light: "#FAEEDA", label: "文生视频", badge: "AI" },
  image2video:   { color: "#D4537E", light: "#FBEAF0", label: "图生视频", badge: "AI" },
  output:        { color: "#639922", light: "#EAF3DE", label: "输出保存", badge: "IO" },
}

function BaseNode({ id, data, selected, nodeType }) {
  const style = NODE_STYLES[nodeType] || NODE_STYLES.chat_optimize
  const { deleteElements } = useReactFlow()

  const handleDelete = useCallback((e) => {
    e.stopPropagation()
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  return (
    <div
      className={`rounded-xl border min-w-[200px] transition-all duration-200 relative group ${
        selected
          ? "shadow-md ring-2"
          : "shadow-sm hover:shadow-md"
      }`}
      style={{
        borderColor: selected ? style.color : "var(--border-default)",
        background: "var(--bg-surface)",
        "--ring-color": style.color,
        boxShadow: selected
          ? `0 0 0 2px ${style.color}22, 0 4px 12px rgba(44,44,42,0.08)`
          : undefined,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-t-xl"
        style={{ background: style.color }}
      >
        <span className="text-white" style={{ opacity: 0.9 }}>
          {icons[nodeType] || icons.chat_optimize}
        </span>
        <span className="text-xs font-medium text-white" style={{ opacity: 0.95 }}>
          {style.label}
        </span>
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded ml-1"
          style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}
        >
          {style.badge}
        </span>
        <button onClick={handleDelete}
          className="ml-auto text-white/50 hover:text-white text-sm leading-none px-1 py-0.5 rounded hover:bg-black/20 transition-colors"
          title="删除节点">
          删除
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-1.5">
        {data.prompt && (
          <p className="text-[11px] leading-relaxed break-words whitespace-pre-wrap max-w-[180px] truncate"
             style={{ color: "var(--text-secondary)" }}>
            {data.prompt}
          </p>
        )}
        {!data.prompt && (
          <p className="text-[11px] italic break-words max-w-[180px]"
             style={{ color: "var(--text-tertiary)" }}>
            双击编辑
          </p>
        )}

        {/* Type-specific info */}
        {nodeType === "text2image" && data.size && (
          <div className="flex gap-2 text-[10px] flex-wrap" style={{ color: "var(--text-tertiary)" }}>
            <span>{data.size}</span>
            {data.model && <span>· {data.model.split("-").slice(0,3).join("-")}</span>}
            <span>· x{data.n || 1}</span>
          </div>
        )}
        {nodeType === "chat_optimize" && data.systemPrompt && (
          <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>
            系统: {data.systemPrompt.slice(0, 30)}...
          </p>
        )}
        {nodeType === "chat_optimize" && data.model && (
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            模型: {data.model}
          </p>
        )}
        {(nodeType === "text2video" || nodeType === "image2video") && (
          <div className="text-[10px] space-y-0.5" style={{ color: "var(--text-tertiary)" }}>
            {data.model && <p>模型: {data.model}</p>}
            {(data.width || data.height) && <p>分辨率: {data.width || "?"}x{data.height || "?"}</p>}
            {data.imageUrl && <p className="truncate">参考图: {data.imageUrl.slice(0, 25)}...</p>}
          </div>
        )}
        {nodeType === "output" && (
          <div className="text-[10px] space-y-0.5" style={{ color: "var(--text-tertiary)" }}>
            {data.resultType && <p>已接收: {data.resultType}</p>}
            {data.format && <p>格式: {data.format}</p>}
            {(data.resultUrl || data.resultUrls) && (
              <p className="text-xs" style={{ color: style.color }}>&#10003; 数据已接收</p>
            )}
          </div>
        )}

        {/* Result preview */}
        {(data.resultUrl || data.resultUrls) && (
          <div className="mt-1.5 pt-1.5 space-y-1"
               style={{ borderTop: "1px solid var(--border-light)" }}>
            {nodeType === "text2image" ? (
              (data.resultUrls?.length > 1 ? data.resultUrls : [data.resultUrl]).map((url, i) => (
                <img key={i} src={url} alt=""
                  className="w-full max-h-48 object-contain rounded-lg"
                  style={{ background: "var(--bg-canvas)" }} />
              ))
            ) : nodeType === "text2video" || nodeType === "image2video" ? (
              <video src={data.resultUrl} controls
                className="w-full max-h-48 object-contain rounded-lg"
                style={{ background: "var(--bg-canvas)" }} />
            ) : null}
          </div>
        )}
      </div>

      {/* Handles */}
      {nodeType !== "chat_optimize" && (
        <Handle type="target" position={Position.Left} />
      )}
      {nodeType !== "output" && (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  )
}

export const ChatOptimizeNode = memo((props) => <BaseNode {...props} nodeType="chat_optimize" />)
export const ImageGenNode = memo((props) => <BaseNode {...props} nodeType="text2image" />)
export const VideoGenNode = memo((props) => <BaseNode {...props} nodeType="text2video" />)
export const Image2VideoNode = memo((props) => <BaseNode {...props} nodeType="image2video" />)
export const OutputNode = memo((props) => <BaseNode {...props} nodeType="output" />)
