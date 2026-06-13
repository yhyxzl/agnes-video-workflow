import React, { useState, useCallback, useRef, useEffect } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { ChatOptimizeNode, ImageGenNode, VideoGenNode, Image2VideoNode, OutputNode } from "../canvas/Nodes"
import NodeSidebar from "../canvas/NodeSidebar"
import NodePropertiesPanel from "../canvas/NodePropertiesPanel"
import SettingsModal from "../components/SettingsModal"
import { chat, generateImage, generateVideo, getVideoStatus, submitBatch, getApiConfig } from "../store/api"

const nodeTypes = {
  chat_optimize: ChatOptimizeNode,
  text2image: ImageGenNode,
  text2video: VideoGenNode,
  image2video: Image2VideoNode,
  output: OutputNode,
}

let nodeIdCounter = 0
function newNodeId() {
  return `node_${++nodeIdCounter}_${Date.now().toString(36)}`
}

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: "#B4B2A9", strokeWidth: 2 },
}

const STORAGE_KEY = "agnes_workflow"
const THEME_KEY = "agnes_theme"

// ── Topological sort ──
function topoSort(nodes, edges) {
  const inDegree = {}
  const adj = {}
  nodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = [] })
  edges.forEach(e => {
    if (adj[e.source] && adj[e.source].indexOf(e.target) === -1) {
      adj[e.source].push(e.target)
      inDegree[e.target] = (inDegree[e.target] || 0) + 1
    }
  })
  const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id)
  const order = []
  while (queue.length > 0) {
    const id = queue.shift()
    order.push(id)
    for (const next of (adj[id] || [])) {
      inDegree[next]--
      if (inDegree[next] === 0) queue.push(next)
    }
  }
  return order
}

// ── localStorage persistence ──
function loadWorkflow() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data.nodes && data.edges) {
        const maxId = Math.max(0, ...data.nodes.map(n => parseInt(n.id.split("_")[1] || "0")))
        nodeIdCounter = maxId
        return data
      }
    }
  } catch { /* ignore */ }
  return { nodes: [], edges: [] }
}

function saveWorkflow(nodes, edges) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }))
  } catch { /* ignore */ }
}

// ── SVG Icons ──
const SvgIcons = {
  undo: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3L2 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 7h7a4 4 0 010 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  redo: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 7H6a4 4 0 000 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  import_: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12v2h12v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  export_: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 11V2M4 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12v2h12v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  clear: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M5.5 4V2.5a.5.5 0 01.5-.5h4a.5.5 0 01.5.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M4 4l1 9.5a1 1 0 001 .9h4a1 1 0 001-.9L12 4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  play: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2l10 6-10 6V2z" fill="currentColor"/></svg>,
  settings: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.5 2.5l1.5 1.5M12 12l1.5 1.5M2.5 13.5l1.5-1.5M12 4l1.5-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  sun: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  moon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13.5 9A6 6 0 017 2.5 6 6 0 1013.5 9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  runMany: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3l5 5-5 5V3z" fill="currentColor" opacity="0.5"/><path d="M8 3l5 5-5 5V3z" fill="currentColor"/></svg>,
  cancel: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
}

export default function Studio() {
  const saved = loadWorkflow()
  const [nodes, setNodes, onNodesChange] = useNodesState(saved.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved.edges)
  const [selectedNode, setSelectedNode] = useState(null)
  const reactFlowWrapper = useRef(null)
  const [reactFlowInstance, setReactFlowInstance] = useState(null)
  const persistTimer = useRef(null)

  // ── Theme ──
  const [dark, setDark] = useState(() => {
    return localStorage.getItem(THEME_KEY) === "dark"
  })

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light")
  }, [dark])

  // ── Workflow execution state ──
  const [running, setRunning] = useState(false)
  const [runProgress, setRunProgress] = useState({ current: 0, total: 0, status: "" })
  const abortRef = useRef(false)
  const [firstRun, setFirstRun] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [repeatCount, setRepeatCount] = useState(1)
  const [showReminder, setShowReminder] = useState(true)

  // ── Output results floating window ──
  const [outputResults, setOutputResults] = useState([])
  const [outputWinOpen, setOutputWinOpen] = useState(false)
  const [floatingPos, setFloatingPos] = useState({ x: 40, y: 40 })
  const [dragState, setDragState] = useState(null)

  // ── History ──
  const [history, setHistory] = useState([{ nodes: saved.nodes, edges: saved.edges }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const historyTimer = useRef(null)
  const skipHistoryRef = useRef(false)

  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return }
    if (historyTimer.current) clearTimeout(historyTimer.current)
    historyTimer.current = setTimeout(() => {
      setHistory(prev => {
        const trimmed = prev.slice(0, historyIndex + 1)
        trimmed.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) })
        if (trimmed.length > 50) trimmed.shift()
        return trimmed
      })
      setHistoryIndex(prev => Math.min(prev + 1, 49))
    }, 300)
  }, [nodes, edges])

  const handleUndo = useCallback(() => {
    if (running || historyIndex <= 0) return
    const newIdx = historyIndex - 1
    const snapshot = history[newIdx]
    if (snapshot) {
      skipHistoryRef.current = true
      setNodes(snapshot.nodes)
      setEdges(snapshot.edges)
      setHistoryIndex(newIdx)
    }
  }, [running, historyIndex, history, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    if (running || historyIndex >= history.length - 1) return
    const newIdx = historyIndex + 1
    const snapshot = history[newIdx]
    if (snapshot) {
      skipHistoryRef.current = true
      setNodes(snapshot.nodes)
      setEdges(snapshot.edges)
      setHistoryIndex(newIdx)
    }
  }, [running, historyIndex, history, setNodes, setEdges])

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      if (e.ctrlKey && e.key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo() }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  useEffect(() => {
    if (!localStorage.getItem("agnes_welcome_shown")) {
      localStorage.setItem("agnes_welcome_shown", "1")
      setShowWelcome(true)
    }
    const config = getApiConfig()
    if (!config.outputDir && !config.apiKey) {
      if (!localStorage.getItem("agnes_first_run_shown")) {
        localStorage.setItem("agnes_first_run_shown", "1")
        setFirstRun(true)
        setSettingsOpen(true)
      }
    }
  }, [])

  // ── Auto-persist ──
  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => saveWorkflow(nodes, edges), 500)
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current) }
  }, [nodes, edges])

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      const type = event.dataTransfer.getData("application/reactflow")
      if (!type || !reactFlowInstance) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const defaultData = {
        chat_optimize: { prompt: "", systemPrompt: "", model: "" },
        text2image: { prompt: "", size: "1024x1024", n: 1, model: "" },
        text2video: { prompt: "", model: "", width: "", height: "" },
        image2video: { prompt: "", imageUrl: "", model: "", width: "", height: "" },
        output: { format: "auto" },
      }[type] || { prompt: "" }

      const newNode = {
        id: newNodeId(),
        type,
        position,
        data: defaultData,
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [reactFlowInstance, setNodes]
  )

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const updateNodeData = useCallback((nodeId, newData) => {
    setNodes(nds => nds.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
    ))
  }, [setNodes])

  const onNodesChangeHandler = useCallback(
    (changes) => {
      for (const c of changes) {
        if (c.type === "remove" && c.id === selectedNode?.id) {
          setSelectedNode(null)
          break
        }
      }
      onNodesChange(changes)
    },
    [onNodesChange, selectedNode]
  )

  // ── Data collection ──
  function collectInputs(nodeId, edges, nodesMap) {
    const inputs = {}
    const incomingEdges = edges.filter(e => e.target === nodeId)
    for (const e of incomingEdges) {
      const src = nodesMap[e.source]
      if (!src) continue
      if (src.data.resultType === "text") {
        inputs.optimizedPrompt = src.data.resultText || ""
      }
      if (src.data.resultType === "image") {
        inputs.imageUrl = src.data.resultUrl || ""
        inputs.imageUrls = src.data.resultUrls || []
      }
      if (src.data.resultType === "video") {
        inputs.videoUrl = src.data.resultUrl || ""
      }
      inputs.incomingData = src.data
    }
    return inputs
  }

  // ── Execute single node ──
  async function executeNode(node, inputs, onProgress) {
    const prompt = inputs.optimizedPrompt || node.data.prompt || ""

    switch (node.type) {
      case "chat_optimize": {
        const system = node.data.systemPrompt || "你是一位专业的视频/图像生成提示词优化专家。"
        const model = node.data.model || "agnes-2.0-flash"
        const msgs = [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ]
        onProgress(20, "优化提示词中...")
        const res = await chat(msgs, model)
        onProgress(70, "处理结果中...")
        const reply = res.choices?.[0]?.message?.content || ""
        return { resultType: "text", resultText: reply }
      }

      case "text2image": {
        const size = node.data.size || "1024x1024"
        const n = node.data.n || 1
        const model = node.data.model || "agnes-image-2.1-flash"
        onProgress(15, "请求图片生成中...")
        const res = await generateImage(prompt, size, n, model)
        onProgress(70, "保存图片到本地...")
        const urls = (res.data || []).map(d => d.url).filter(Boolean)
        if (urls.length > 0) {
          return { resultType: "image", resultUrl: urls[0], resultUrls: urls }
        }
        return { resultType: "error", resultError: "No images returned" }
      }

      case "text2video":
      case "image2video": {
        const vidPrompt = node.data.prompt || prompt
        const imageUrl = inputs.imageUrl || node.data.imageUrl || null
        const model = node.data.model || "agnes-video-v2.0"
        const width = node.data.width || ""
        const height = node.data.height || ""
        onProgress(5, "提交视频请求中...")
        const res = await generateVideo(vidPrompt, model, imageUrl || null, width, height, node.data.num_frames, node.data.frame_rate)
        onProgress(15, "等待视频生成中...")

        if (res.status === "completed" && res.video_url) {
          onProgress(95, "视频已成功生成")
          return { resultType: "video", resultUrl: res.video_url, videoId: res.video_id }
        }

        if ((res.status === "queued" || res.status === "in_progress" || res.status === "pending") && res.video_id) {
          const videoId = res.video_id
          let attempts = 0
          const maxAttempts = 60
          onProgress(20, "视频已排队，轮询进度中...")

          while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 5000))
            attempts++
            const pct = Math.min(20 + Math.floor(attempts / maxAttempts * 65), 85)
            onProgress(pct, `轮询中 (${attempts * 5}s / 300s)...`)

            try {
              const pollRes = await getVideoStatus(videoId)
              if (pollRes.status === "completed" && pollRes.video_url) {
                onProgress(95, "视频已成功生成")
                return {
                  resultType: "video",
                  resultUrl: pollRes.video_url,
                  videoId: videoId,
                  localPath: pollRes.local_path,
                }
              }
              if (pollRes.status === "failed") {
                onProgress(100, "视频生成失败")
                return { resultType: "error", resultError: pollRes.message || "视频生成失败" }
              }
              if (pollRes.progress > 0) {
                onProgress(Math.min(20 + pollRes.progress * 0.65, 85), `生成中 ${pollRes.progress}%`)
              }
            } catch {
              // retry
            }
          }

          onProgress(100, "轮询超时")
          return { resultType: "error", resultError: "视频生成超时（5分钟）" }
        }

        onProgress(100, "缺少 video_id")
        return { resultType: "error", resultError: `视频状态: ${res.status}` }
      }

      case "output": {
        onProgress(50, "接收上游数据中...")
        const inc = inputs.incomingData || {}
        const resultType = inc.resultType || "info"
        const result = {
          resultType,
          resultText: inc.resultText || "",
          resultUrl: inc.resultUrl || "",
          resultUrls: inc.resultUrls || [],
          resultInfo: `已接收 ${resultType} 输出`,
        }
        return result
      }

      default:
        return { resultType: "error", resultError: "Unknown node type" }
    }
  }

  // ── Run All ──
  const handleRunAll = useCallback(async () => {
    if (running || nodes.length === 0) return
    abortRef.current = false
    setRunning(true)
    setOutputWinOpen(false)
    setOutputResults([])
    setRunProgress({ current: 0, total: nodes.length, status: "运行中...", nodeProgress: 0, nodeLabel: "" })
    await runWorkflowOnce()
    setRunProgress(prev => ({ ...prev, status: abortRef.current ? "已取消" : "已完成" }))
    setRunning(false)

    // 执行完成后，收集所有有图片结果的节点
    const results = nodes
      .filter(n => (n.data.resultUrl || n.data.resultUrls?.length > 0) && n.data.resultType !== "text")
      .map(n => ({
        id: n.id,
        label: NODE_STYLES[n.type]?.label || n.type,
        resultType: n.data.resultType,
        resultUrl: n.data.resultUrl,
        resultUrls: n.data.resultUrls || (n.data.resultUrl ? [n.data.resultUrl] : []),
        resultText: n.data.resultText,
        resultInfo: n.data.resultInfo,
      }))
    if (results.length > 0) {
      setOutputResults(results)
      setOutputWinOpen(true)
      setFloatingPos({ x: 40, y: 40 })
    }
  }, [nodes, edges, running])

  // ── Run Many ──
  const handleRunMany = useCallback(async () => {
    if (running || nodes.length === 0 || repeatCount < 1) return
    abortRef.current = false
    setRunning(true)

    for (let i = 0; i < repeatCount; i++) {
      if (abortRef.current) break
      setRunProgress({
        current: i, total: repeatCount,
        status: `Run ${i + 1}/${repeatCount}`,
        nodeProgress: 0,
        nodeLabel: "准备中...",
      })
      await runWorkflowOnce()
    }

    setRunProgress(prev => ({ ...prev, status: abortRef.current ? "已取消" : `已完成 ${repeatCount} 次运行`, nodeLabel: "" }))
    setRunning(false)
  }, [nodes, edges, running, repeatCount])

  async function runWorkflowOnce() {
    const order = topoSort(nodes, edges)
    const nodesMap = {}
    nodes.forEach(n => { nodesMap[n.id] = n })

    for (const nodeId of order) {
      if (abortRef.current) break
      const node = nodesMap[nodeId]
      if (!node) continue

      try {
        const inputs = collectInputs(nodeId, edges, nodesMap)
        const onProgress = (pct, label) => {
          setRunProgress(prev => ({ ...prev, nodeProgress: Math.min(pct, 99), nodeLabel: label }))
        }
        const result = await executeNode(node, inputs, onProgress)
        setRunProgress(prev => ({ ...prev, nodeProgress: 100, nodeLabel: "已完成" }))
        await new Promise(r => setTimeout(r, 200))
        updateNodeData(nodeId, { ...result })
        nodesMap[nodeId] = { ...nodesMap[nodeId], data: { ...nodesMap[nodeId].data, ...result } }
      } catch (err) {
        updateNodeData(nodeId, { resultType: "error", resultError: err.message })
        setRunProgress(prev => ({ ...prev, nodeLabel: `Failed: ${err.message}` }))
      }
    }
  }

  const handleCancelRun = useCallback(() => {
    abortRef.current = true
  }, [])

  const handleExport = () => {
    const workflow = { nodes, edges }
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `workflow_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.nodes) setNodes(data.nodes)
        if (data.edges) setEdges(data.edges)
        nodeIdCounter = Math.max(...data.nodes.map(n => parseInt(n.id.split("_")[1] || "0")), 0)
      } catch {
        alert("JSON parse failed")
      }
    }
    reader.readAsText(file)
  }

  const handleClear = () => {
    setNodes([])
    setEdges([])
    setSelectedNode(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <ReactFlowProvider>
      {/* ─── Top Toolbar ─── */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, #D85A30, #378ADD)" }}
          >
            A
          </div>
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Agnes <span style={{ color: "var(--text-tertiary)" }}>studio</span>
          </span>
          <a href="https://github.com/yhyxzl/agnes-video-workflow" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full transition-all duration-150 font-medium group"
            style={{
              background: "linear-gradient(135deg, #FAECE7, #F5C4B3)",
              border: "1px solid #F0997B",
              color: "#993C1D",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, #F5C4B3, #F0997B)";
              e.currentTarget.style.borderColor = "#D85A30";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "linear-gradient(135deg, #FAECE7, #F5C4B3)";
              e.currentTarget.style.borderColor = "#F0997B";
            }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="group-hover:scale-110 transition-transform duration-150" style={{ marginTop: -1 }}>
              <path d="M8 .5l2 4.5 5 .5-3.5 3.5L12.5 14 8 11.5 3.5 14l1-5L1 5.5l5-.5L8 .5z" fill="currentColor" opacity="0.9"/>
            </svg>
            创作者
          </a>
        </div>

        {running ? (
          <div className="flex items-center gap-3 flex-1 max-w-lg mx-auto">
            <div className="flex-1 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    步骤 {runProgress.current + 1}/{runProgress.total}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {runProgress.nodeProgress || 0}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--border-light)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${runProgress.nodeProgress || 0}%`,
                    background: "var(--brand)",
                  }}
                />
              </div>
              <p className="text-[9px] truncate" style={{ color: "var(--text-tertiary)" }}>
                {runProgress.nodeLabel || runProgress.status}
              </p>
            </div>
            <button onClick={handleCancelRun}
              className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded border"
              style={{
                background: "var(--brand-soft)",
                borderColor: "var(--border-default)",
                color: "var(--brand)",
              }}>
              {SvgIcons.cancel}
              取消
            </button>
          </div>
        ) : runProgress.total > 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium" style={{
              color: runProgress.status.includes("完成") ? "#639922" : "var(--text-secondary)"
            }}>
              &#10003; {runProgress.status} ({runProgress.current}/{runProgress.total})
            </span>
            <button onClick={() => setRunProgress({ current: 0, total: 0, status: "", nodeProgress: 0, nodeLabel: "" })}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ color: "var(--text-tertiary)" }}>
              清空
            </button>
          </div>
        ) : (
          <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            拖拽 &mdash; 连线 &mdash; 执行
          </span>
        )}

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReminder(v => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors relative"
            style={{
              background: showReminder ? "var(--brand-soft)" : "var(--bg-surface)",
              borderColor: showReminder ? "var(--brand)" : "var(--border-default)",
              color: showReminder ? "var(--brand)" : "var(--text-secondary)",
            }}
            title={showReminder ? "收起运行提示" : "展开运行提示"}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5A5.5 5.5 0 002.5 7v2l-1 2.5h13L13.5 9V7A5.5 5.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M6 12.5a2 2 0 004 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            onClick={() => setDark(d => !d)}
            className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
            title="切换主题"
          >
            {dark ? SvgIcons.sun : SvgIcons.moon}
          </button>
          <button onClick={() => setSettingsOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md border transition-colors"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-default)",
              color: "var(--text-secondary)",
            }}
            title="设置">
            {SvgIcons.settings}
          </button>
        </div>
      </div>

      {/* ── 常驻运行提示（右上角铃铛按钮控制） ── */}
      {showReminder && (
        <div
          className="flex items-center gap-3 px-4 py-1.5 border-b"
          style={{
            background: "var(--bg-page)",
            borderColor: "var(--border-default)",
          }}
        >
          <span className="shrink-0 text-xs leading-none">💡</span>
          <p className="text-[11px] leading-relaxed flex-1" style={{ color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)" }}>运行贴士：</strong>
            后端 API 连接失败时无需关闭终端，重新运行 launcher 即可自动重连。
            <span className="mx-1.5 opacity-30">|</span>
            反馈 bug：
            <a
              href="mailto:yx123asdfg@outlook.com"
              className="underline underline-offset-2 hover:no-underline"
              style={{ color: "var(--brand)" }}
            >
              yx123asdfg@outlook.com
            </a>
          </p>
          <button
            onClick={() => setShowReminder(false)}
            className="shrink-0 text-xs leading-none opacity-40 hover:opacity-100 transition-opacity"
            style={{ color: "var(--text-tertiary)" }}
            title="关闭提示"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex" style={{ height: showReminder ? "calc(100vh - 79px)" : "calc(100vh - 41px)" }}>
        {/* ─── Left Sidebar ─── */}
        <div
          className="w-52 overflow-y-auto shrink-0 border-r"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-default)",
          }}
        >
          <NodeSidebar onDrop={onDrop} />
        </div>

        {/* ─── Canvas ─── */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChangeHandler}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background variant="dots" gap={20} size={1} color="#B4B2A9" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => ({
                chat_optimize: "#7F77DD",
                text2image: "#378ADD",
                text2video: "#BA7517",
                image2video: "#D4537E",
                output: "#639922",
              }[n.type] || "#B4B2A9")}
              maskColor="rgba(180,178,169,0.15)"
            />
          </ReactFlow>

          {/* Floating toolbar */}
          <div className="absolute top-3 left-3 z-10 flex gap-1.5 items-center">
            <button onClick={handleUndo} disabled={running || historyIndex <= 0}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-30"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                boxShadow: "var(--shadow-sm)",
              }}
              title="撤销 Ctrl+Z">
              {SvgIcons.undo}
            </button>
            <button onClick={handleRedo} disabled={running || historyIndex >= history.length - 1}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-30"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                boxShadow: "var(--shadow-sm)",
              }}
              title="重做 Ctrl+Shift+Z">
              {SvgIcons.redo}
            </button>
            <span className="text-[9px] mx-0.5" style={{ color: "var(--text-tertiary)" }}>
              {historyIndex}/{history.length - 1}
            </span>

            <div className="w-px h-4 mx-0.5" style={{ background: "var(--border-light)" }} />

            <button onClick={handleClear}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                boxShadow: "var(--shadow-sm)",
              }}>
              {SvgIcons.clear}
              清空
            </button>
            <button onClick={handleExport}
              disabled={nodes.length === 0}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                boxShadow: "var(--shadow-sm)",
              }}>
              {SvgIcons.export_}
              导出
            </button>
            <label
              className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                boxShadow: "var(--shadow-sm)",
              }}>
              {SvgIcons.import_}
              导入
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>

            <div className="w-px h-4 mx-0.5" style={{ background: "var(--border-light)" }} />

            <button onClick={() => repeatCount > 1 ? handleRunMany() : handleRunAll()}
              disabled={running || nodes.length === 0}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-40"
              style={{
                background: "var(--brand)",
                borderColor: "var(--brand)",
                color: "#fff",
                boxShadow: "var(--shadow-sm)",
              }}>
              {SvgIcons.play}
              {running ? "运行中..." : `执行 ${repeatCount}×`}
            </button>
            <input type="number" min={1} max={99}
              value={repeatCount}
              onChange={e => setRepeatCount(Math.max(1, Math.min(99, +e.target.value || 1)))}
              className="w-10 text-[10px] text-center px-1 py-1.5 rounded border"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* ─── Right Panel ─── */}
        <div
          className="w-72 overflow-y-auto shrink-0 border-l"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-default)",
          }}
        >
          <NodePropertiesPanel
            node={selectedNode}
            updateNodeData={updateNodeData}
            onDeleteNode={(nodeId) => {
              setNodes(nds => nds.filter(n => n.id !== nodeId))
              setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
              setSelectedNode(prev => prev?.id === nodeId ? null : prev)
            }}
          />
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => { setSettingsOpen(false); setFirstRun(false) }} firstRun={firstRun} />

      {/* ── 输出结果浮窗（固定大浮窗，显示图片+URL+复制按钮） ── */}
      {outputWinOpen && outputResults.length > 0 && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setOutputWinOpen(false)} />
          <style>{`
            @keyframes floatIn { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
          `}</style>
          <div
            className="fixed z-50"
            onMouseMove={(e) => {
              if (!dragState) return
              setFloatingPos({
                x: e.clientX - dragState.offsetX,
                y: e.clientY - dragState.offsetY,
              })
            }}
            onMouseUp={() => setDragState(null)}
            onMouseLeave={() => setDragState(null)}
          >
            {outputResults.map((result, ri) => {
              const urls = result.resultUrls?.length > 0 ? result.resultUrls : (result.resultUrl ? [result.resultUrl] : [])
              if (urls.length === 0) return null
              const pos = ri === 0 ? floatingPos : { x: floatingPos.x + ri * 20, y: floatingPos.y + ri * 20 }

              return (
                <div
                  key={result.id}
                  className="fixed bg-white dark:bg-[#1E1E1C] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#3A3A37] overflow-hidden"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: 520,
                    maxHeight: 'calc(100vh - 80px)',
                    zIndex: 50 + ri,
                    animation: `floatIn 0.3s ease ${ri * 0.08}s both`,
                  }}
                >
                  {/* 标题栏（可拖动） */}
                  <div
                    className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#2C2C2A] cursor-grab active:cursor-grabbing select-none border-b border-gray-200 dark:border-[#3A3A37]"
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.closest('[class*="fixed"]')?.getBoundingClientRect()
                      setDragState({
                        offsetX: e.clientX - (rect?.left || floatingPos.x),
                        offsetY: e.clientY - (rect?.top || floatingPos.y),
                      })
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{result.label}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#1E1E1C] px-2 py-0.5 rounded">{result.resultType}</span>
                      {result.resultText && <span className="text-[10px] text-gray-400 truncate max-w-[180px]">{result.resultText.slice(0, 50)}</span>}
                    </div>
                    <button
                      onClick={() => setOutputWinOpen(false)}
                      className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* 图片内容区域（可滚动） */}
                  <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
                    <div className="space-y-3 p-4">
                      {urls.map((url, ui) => (
                        <div key={ui} className="space-y-2">
                          <div className="bg-gray-100 dark:bg-[#1A1A18] rounded-xl overflow-hidden flex items-center justify-center">
                            <img
                              src={url}
                              alt=""
                              className="w-full max-h-80 object-contain"
                              loading="lazy"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <label className="block text-[9px] font-medium text-gray-400 dark:text-gray-500 mb-0.5">本地 URL</label>
                              <div className="flex items-center bg-gray-50 dark:bg-[#242422] rounded-lg border border-gray-200 dark:border-[#3A3A37] overflow-hidden">
                                <input
                                  type="text"
                                  readOnly
                                  value={url}
                                  className="flex-1 bg-transparent text-[11px] text-gray-700 dark:text-gray-300 px-2.5 py-2 outline-none min-w-0 font-mono"
                                  onClick={(e) => e.target.select()}
                                />
                                <button
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(url)
                                      const btn = document.activeElement
                                      if (btn) btn.textContent = '已复制'
                                      setTimeout(() => { if (btn) btn.textContent = '复制' }, 2000)
                                    } catch {
                                      const ta = document.createElement('textarea')
                                      ta.value = url
                                      document.body.appendChild(ta)
                                      ta.select()
                                      document.execCommand('copy')
                                      document.body.removeChild(ta)
                                    }
                                  }}
                                  className="shrink-0 px-3 py-2 text-[11px] font-medium bg-gray-50 dark:bg-[#242422] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2A] border-l border-gray-200 dark:border-[#3A3A37] transition-colors"
                                >
                                  复制
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <a href={url} target="_blank" rel="noreferrer"
                              className="flex-1 text-center text-[11px] bg-gray-100 dark:bg-[#2C2C2A] hover:bg-gray-200 dark:hover:bg-[#3A3A37] text-gray-600 dark:text-gray-400 px-3 py-2 rounded-lg transition-colors">
                              新标签页
                            </a>
                            <button onClick={() => { const a = document.createElement('a'); a.href = url; a.download = url.split('/').pop() || 'output'; a.click() }}
                              className="flex-1 text-center text-[11px] bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors">
                              下载
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Welcome Popup (first visit only) ── */}
      {showWelcome && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
        >
          <div
            className="rounded-xl border w-[380px] shadow-lg px-6 py-8 text-center"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-default)",
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #D85A30, #378ADD)" }}
            >
              A
            </div>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
              感谢 Agnes 开源 🙏
            </h2>
            <p className="text-xs leading-relaxed mb-5" style={{ color: "var(--text-secondary)" }}>
              Agnes 让 AI 视频创作触手可及。
              <br />
              每个 Star 都是开发者凌晨改 Bug 的回血包 🩹
            </p>
            <div className="flex flex-col gap-2">
              <a href="https://github.com/yhyxzl/agnes-video-workflow" target="_blank" rel="noopener noreferrer"
                className="w-full text-xs font-medium py-2.5 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                style={{
                  background: "#D85A30",
                  color: "#fff",
                }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                去 GitHub 点个 Star ⭐
              </a>
              <button onClick={() => setShowWelcome(false)}
                className="w-full text-xs py-2 rounded-lg border transition-colors"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-tertiary)",
                }}>
                开始使用
              </button>
            </div>
          </div>
        </div>
      )}
    </ReactFlowProvider>
  )
}
