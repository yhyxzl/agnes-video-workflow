import React, { useState, useEffect } from "react"
import { submitBatch, listBatchJobs } from "../store/api"

const STEP_TYPES = [
  { value: "chat_optimize", label: "提示词优化", icon: "✏️" },
  { value: "text2image", label: "文生图", icon: "🖼️" },
  { value: "text2video", label: "文生视频", icon: "🎬" },
  { value: "image2video", label: "图生视频", icon: "🎥" },
]

export default function BatchExecute() {
  const [name, setName] = useState("batch_run_" + Date.now())
  const [steps, setSteps] = useState([])
  const [count, setCount] = useState(3)
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState([])
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      listBatchJobs().then(setJobs).catch(() => {})
    }, 3000)
    listBatchJobs().then(setJobs).catch(() => {})
    return () => clearInterval(interval)
  }, [refresh])

  const addStep = (type) => {
    const prompt = prompt("提示词: ")
    if (!prompt) return
    setSteps(prev => [...prev, { id: "s_" + Date.now() + "_" + prev.length, type, prompt, config: {} }])
  }

  const removeStep = (id) => setSteps(prev => prev.filter(s => s.id !== id))

  const handleRun = async () => {
    if (steps.length === 0 || count < 1) return
    setLoading(true)
    try {
      const workflow = { name, steps, input_variations: Array.from({ length: count }, (_, i) => ({ prompt: "Variation " + (i + 1) })) }
      const res = await submitBatch(workflow)
      setRefresh(r => r + 1)
    } catch (err) {
      alert("提交失败: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dark-100 mb-2">批量执行</h2>
        <p className="text-dark-500 text-sm">批量运行工作流并监控进度</p>
      </div>

      {/* Config */}
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-5 space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-dark-400 mb-1.5">运行名称</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-dark-200 focus:outline-none focus:border-brand-500" />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-dark-400 mb-1.5">批次数</label>
            <input type="number" min={1} max={20} value={count} onChange={e => setCount(+e.target.value)}
              className="w-full bg-dark-700 border border-dark-600 rounded-lg px-3 py-2 text-sm text-dark-200 text-center" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-dark-400 mb-2">工作流步骤</label>
          <div className="flex gap-2 mb-3">
            {STEP_TYPES.map(t => (
              <button key={t.value} onClick={() => addStep(t.value)}
                className="bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-lg px-3 py-2 text-xs text-dark-300">
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {steps.map(s => (
              <div key={s.id} className="bg-dark-700 rounded-lg px-4 py-2 flex items-center justify-between text-sm">
                <span className="text-dark-300">
                  {STEP_TYPES.find(t => t.value === s.type)?.icon} {s.prompt}
                </span>
                <button onClick={() => removeStep(s.id)} className="text-red-400 hover:bg-dark-600 rounded p-1">×</button>
              </div>
            ))}
            {steps.length === 0 && <p className="text-xs text-dark-600">点击按钮添加步骤</p>}
          </div>
        </div>

        <button onClick={handleRun} disabled={loading || steps.length === 0}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-8 py-2.5 rounded-lg text-sm font-medium w-full">
          {loading ? "提交中..." : "启动批量运行"}
        </button>
      </div>

      {/* Job History */}
      <div>
        <h3 className="text-sm font-semibold text-dark-400 mb-3">运行记录</h3>
        <div className="space-y-2">
          {jobs.map(job => (
            <div key={job.id} className="bg-dark-800 rounded-xl border border-dark-600 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-dark-200">{job.workflow?.name || job.id}</p>
                <p className="text-xs text-dark-500">{new Date(job.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={"text-xs font-medium px-2 py-1 rounded " + (
                  job.status === "completed" ? "bg-green-900 text-green-400" :
                  job.status === "running" ? "bg-blue-900 text-blue-400" :
                  job.status === "failed" ? "bg-red-900 text-red-400" :
                  "bg-dark-700 text-dark-400"
                )}>
                  {job.status}
                </span>
                {job.error && <span className="text-xs text-red-400">{job.error}</span>}
              </div>
            </div>
          ))}
          {jobs.length === 0 && <p className="text-sm text-dark-600">暂无运行记录</p>}
        </div>
      </div>
    </div>
  )
}
