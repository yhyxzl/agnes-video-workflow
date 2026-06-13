import { useCallback } from "react"

/* ─── SVG Icons ─── */
const nodeIcons = {
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

const NODE_DEFS = [
  { type: "chat_optimize", label: "提示词优化", desc: "AI 优化视频/图像提示词", color: "#7F77DD", light: "#EEEDFE" },
  { type: "text2image",    label: "图片生成",  desc: "通过文字生成高质量图片",    color: "#378ADD", light: "#E6F1FB" },
  { type: "text2video",    label: "文生视频",     desc: "通过文字生成视频",     color: "#BA7517", light: "#FAEEDA" },
  { type: "image2video",   label: "图生视频",    desc: "通过图片参考生成视频", color: "#D4537E", light: "#FBEAF0" },
  { type: "output",        label: "输出保存",      desc: "保存并管理输出文件",    color: "#639922", light: "#EAF3DE" },
]

export default function NodeSidebar({ onDrop }) {
  const onDragStart = useCallback((event, nodeDef) => {
    event.dataTransfer.setData("application/reactflow", nodeDef.type)
    event.dataTransfer.effectAllowed = "move"
  }, [])

  return (
    <div className="p-3 space-y-1.5">
      <p
        className="text-[10px] font-semibold uppercase tracking-wider mb-2.5 px-1"
        style={{ color: "var(--text-tertiary)" }}
      >
        组件列表
      </p>
      {NODE_DEFS.map(def => (
        <div
          key={def.type}
          draggable
          onDragStart={(e) => onDragStart(e, def)}
          className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150 border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-light)",
            borderLeftColor: def.color,
            borderLeftWidth: "3px",
          }}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ background: def.light, color: def.color }}
          >
            {nodeIcons[def.type]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              {def.label}
            </p>
            <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>
              {def.desc}
            </p>
          </div>
        </div>
      ))}

      <div className="mt-4 pt-3 space-y-1"
           style={{ borderTop: "1px solid var(--border-light)" }}>
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          拖拽组件到画布<br />
          连线设置执行顺序<br />
          双击节点编辑属性
        </p>
      </div>
    </div>
  )
}
