import React, { useState } from "react"

const STEP_TYPES = [
  { value: "chat_optimize", label: "提示词优化", icon: "✏️" },
  { value: "text2image", label: "文生图", icon: "🖼️" },
  { value: "text2video", label: "文生视频", icon: "🎬" },
  { value: "image2video", label: "图生视频", icon: "🎥" },
]

export default function WorkflowBuilder() {
  const [steps, setSteps] = useState([])
  const [newType, setNewType] = useState("text2image")
  const [newPrompt, setNewPrompt] = useState("")
  const [workflowName, setWorkflowName] = useState("my_workflow")
  const [reminderOpen, setReminderOpen] = useState(true)

  const addStep = () => {
    if (!newPrompt.trim()) return
    const step = {
      id: "step_" + Date.now(),
      type: newType,
      prompt: newPrompt.trim(),
      config: { size: "1024x1024", n: 1, model: newType === "text2video" ? "agnes-video-v2.0" : "agnes-image-2.1-flash" }
    }
    setSteps(prev => [...prev, step])
    setNewPrompt("")
  }

  const removeStep = (id) => setSteps(prev => prev.filter(s => s.id !== id))

  const moveStep = (index, dir) => {
    const newSteps = [...steps]
    const target = index + dir
    if (target < 0 || target >= newSteps.length) return
    ;[newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]]
    setSteps(newSteps)
  }

  const workflow = { name: workflowName, steps }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = workflowName + ".json"
    a.click()
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data.steps) setSteps(data.steps)
      } catch { alert("JSON 解析失败") }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-100 mb-2">工作流编辑器</h2>
          <p className="text-dark-500 text-sm">可视化编排生成工作流</p>
        </div>

        {/* 运行提示 — 可折叠 */}
        <button
          onClick={() => setReminderOpen(v => !v)}
          className="flex items-center gap-1.5 text-xs text-dark-400 hover:text-dark-200 transition-colors"
          title={reminderOpen ? "收起提示" : "展开提示"}
        >
          <span className={`inline-block transition-transform duration-200 ${reminderOpen ? "rotate-0" : "rotate-180"}`}>▼</span>
          {reminderOpen ? "收起提示" : "运行提示"}
        </button>
      </div>

      {/* 可折叠提示栏 */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${reminderOpen ? "max-h-40 opacity-100 mb-0" : "max-h-0 opacity-0 mb-0"}`}>
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 flex items-start gap-3">
          <span className="text-amber-400 text-lg mt-0.5 shrink-0">💡</span>
          <div className="flex-1 text-sm text-amber-200/80 leading-relaxed space-y-1">
            <p><strong className="text-amber-300">运行贴士：</strong>后端 API 连接失败时无需关闭终端，重新运行 <code className="bg-dark-700 px-1.5 py-0.5 rounded text-xs text-amber-300">launcher.py</code> 即可自动重连。</p>
            <p>如遇 bug 请反馈至 <a href="mailto:yx123asdfg@outlook.com" className="text-amber-400 underline underline-offset-2 hover:text-amber-300">yx123asdfg@outlook.com</a></p>
          </div>
        </div>
      </div>

      {/* Name & Import */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-4 flex gap-4 items-center">
        <input value={workflowName} onChange={e => setWorkflowName(e.target.value)}
          className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-brand-500 text-dark-200 w-48"
          placeholder="工作流名称" />
        <label className="bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg px-4 py-2 text-sm text-dark-300 cursor-pointer">
          导入
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        <button onClick={handleExport} disabled={steps.length === 0}
          className="bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg px-4 py-2 text-sm text-dark-300 disabled:opacity-40">
          导出 JSON
        </button>
      </div>

      {/* Add Step */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-4 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-dark-400 mb-1.5">节点类型</label>
          <select value={newType} onChange={e => setNewType(e.target.value)}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-dark-200">
            {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-dark-400 mb-1.5">提示词</label>
          <input value={newPrompt} onChange={e => setNewPrompt(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addStep()}
            className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 text-dark-200"
            placeholder="输入提示词..." />
        </div>
        <button onClick={addStep} disabled={!newPrompt.trim()}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-5 py-2 rounded-lg text-sm font-medium h-10">
          + 添加
        </button>
      </div>

      {/* Step List */}
      <div className="space-y-2">
        {steps.length === 0 && (
          <div className="bg-dark-800 rounded-xl border border-dark-600 p-12 text-center text-dark-600">
            点击上方添加节点开始编排工作流
          </div>
        )}
        {steps.map((step, i) => {
          const typeInfo = STEP_TYPES.find(t => t.value === step.type)
          return (
            <div key={step.id} className="bg-dark-800 rounded-xl border border-dark-600 p-4 flex gap-4 items-start">
              <div className="flex flex-col items-center gap-1 pt-1">
                <span className="text-xl">{typeInfo?.icon}</span>
                <span className="text-xs text-dark-600 font-mono">{i + 1}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-brand-400">{typeInfo?.label}</span>
                  <span className="text-xs text-dark-600">({step.type})</span>
                </div>
                <p className="text-sm text-dark-300 line-clamp-2">{step.prompt}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                  className="w-7 h-7 flex items-center justify-center rounded text-dark-500 hover:bg-dark-700 disabled:opacity-30">↑</button>
                <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}
                  className="w-7 h-7 flex items-center justify-center rounded text-dark-500 hover:bg-dark-700 disabled:opacity-30">↓</button>
                <button onClick={() => removeStep(step.id)}
                  className="w-7 h-7 flex items-center justify-center rounded text-red-400 hover:bg-dark-700">✕</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Execution hint */}
      {steps.length > 0 && (
        <div className="bg-dark-800 rounded-xl border border-dark-600 p-4 flex items-center justify-between">
          <span className="text-sm text-dark-400">{steps.length} 个节点已配置</span>
          <button onClick={() => {
            window.location.href = "/batch?workflow=" + encodeURIComponent(JSON.stringify(workflow))
          }} className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg text-sm font-medium">
            前往批量执行
          </button>
        </div>
      )}
    </div>
  )
}
