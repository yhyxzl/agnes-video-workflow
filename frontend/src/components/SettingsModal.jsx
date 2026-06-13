import React, { useState, useEffect } from "react"
import { getApiConfig, saveApiConfig, syncSettings } from "../store/api"
import { browseDirectory, browseRoots } from "../store/api"

export default function SettingsModal({ open, onClose, firstRun = false }) {
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("https://apihub.agnes-ai.com/v1")
  const [outputDir, setOutputDir] = useState("")
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)  // 与后端同步中
  const [syncError, setSyncError] = useState("") // 同步错误信息

  // Directory browser state
  const [browserOpen, setBrowserOpen] = useState(false)
  const [dirs, setDirs] = useState([])
  const [currentPath, setCurrentPath] = useState("")
  const [parentPath, setParentPath] = useState(null)
  const [loadingDirs, setLoadingDirs] = useState(false)

  useEffect(() => {
    if (open) {
      const config = getApiConfig()
      setApiKey(config.apiKey || "")
      setBaseUrl(config.baseUrl || "https://apihub.agnes-ai.com/v1")
      setOutputDir(config.outputDir || "")
      setSaved(false)
      setSyncError("")
    }
  }, [open])

  const handleSave = async () => {
    const config = {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || "https://apihub.agnes-ai.com/v1",
      outputDir: outputDir.trim(),
    }
    // 1. 保存到 localStorage
    saveApiConfig(config)

    // 2. 同步到后端（加保护，失败不阻断流程）
    let syncSuccess = true
    if (config.apiKey) {
      setSyncing(true)
      setSyncError("")
      try {
        syncSuccess = await syncSettings(config)
        if (!syncSuccess) {
          setSyncError("配置已保存至本地，但未能同步到后端（后端服务未启动？）")
        }
      } catch (e) {
        syncSuccess = false
        setSyncError("同步失败: " + e.message)
      }
      setSyncing(false)
    }

    setSaved(true)
    // 即使同步失败也显示结果，但稍后再关闭
    const delay = (firstRun || syncSuccess) ? 800 : 2500
    setTimeout(() => onClose(), delay)
  }

  const handleClear = () => {
    setApiKey("")
    setBaseUrl("https://apihub.agnes-ai.com/v1")
    setOutputDir("")
    saveApiConfig({})
    setSaved(true)
    setTimeout(() => onClose(), 1200)
  }

  const openBrowser = async () => {
    setBrowserOpen(true)
    setLoadingDirs(true)
    try {
      const roots = await browseRoots()
      if (roots.drives && roots.drives.length > 0) {
        await loadDir(roots.drives[0])
      }
    } catch {
      await loadDir("C:\\")
    }
    setLoadingDirs(false)
  }

  const loadDir = async (path) => {
    setLoadingDirs(true)
    try {
      const data = await browseDirectory(path)
      setDirs(data.dirs || [])
      setCurrentPath(data.current || path)
      setParentPath(data.parent || null)
    } catch {
      setDirs([])
      setCurrentPath(path)
      setParentPath(null)
    }
    setLoadingDirs(false)
  }

  const selectDir = (path) => {
    setOutputDir(path)
    setBrowserOpen(false)
  }

  const goUp = () => {
    if (parentPath) loadDir(parentPath)
  }

  const handleKeyDown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      await handleSave()
    }
  }

  // 不通过 backdrop 点击关闭，只通过 X 按钮或 ESC 关闭
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: firstRun ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)" }}
    >
      <div
        className="rounded-xl border w-[460px] shadow-lg"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
        }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border-light)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {firstRun ? "欢迎 - 初次配置" : "设置"}
          </h3>
          {!firstRun && (
            <button onClick={onClose}
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-surface-hover transition-colors"
              style={{ color: "var(--text-tertiary)" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {firstRun && (
            <div className="rounded-lg px-3 py-2.5" style={{
              background: "#FAECE7",
              border: "1px solid #F0997B",
            }}>
              <p className="text-[11px] leading-relaxed" style={{ color: "#712B13" }}>
                请先配置输出文件夹和 API 密钥，然后开始使用。
              </p>
            </div>
          )}

          {saved ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              {syncing ? (
                <>
                  <span className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"></span>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>同步中...</span>
                </>
              ) : syncError ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#D85A30" strokeWidth="1.5"/>
                    <path d="M8 5v3M8 10.5v.5" stroke="#D85A30" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="text-xs" style={{ color: "#D85A30" }}>
                    {syncError}
                  </span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3 4 7-8" stroke="#639922" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-sm" style={{ color: "#639922" }}>已保存</span>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Output folder */}
              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  输出文件夹
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outputDir}
                    onChange={e => setOutputDir(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 rounded-lg px-3 py-2 text-xs transition-colors"
                    style={{
                      background: "var(--bg-surface-hover)",
                      border: "1px solid var(--border-light)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="C:\Users\optim\agnes-outputs"
                  />
                  <button onClick={openBrowser}
                    className="shrink-0 flex items-center gap-1 text-xs px-3 py-2 rounded-lg border transition-colors"
                    style={{
                      background: "var(--bg-surface-hover)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }}
                    title="浏览">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4h5l2 2h5v7H2V4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                    </svg>
                    浏览
                  </button>
                </div>
                <p className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                  生成的文件将保存到此文件夹
                </p>
              </div>

              {/* Directory browser */}
              {browserOpen && (
                <div className="rounded-lg border overflow-hidden"
                  style={{
                    background: "var(--bg-page)",
                    borderColor: "var(--border-default)",
                  }}>
                  {/* Path nav */}
                  <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <button onClick={goUp} disabled={!parentPath || loadingDirs}
                      className="flex items-center justify-center w-5 h-5 rounded hover:bg-surface-hover disabled:opacity-30 transition-colors"
                      style={{ color: "var(--text-secondary)" }}>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <path d="M8 3v10M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <span className="text-[10px] font-mono flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                      {currentPath}
                    </span>
                    {loadingDirs && <span className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>加载中...</span>}
                  </div>

                  {/* Directory list */}
                  <div className="max-h-48 overflow-y-auto">
                    <button onClick={async () => {
                      try {
                        const roots = await browseRoots()
                        const items = roots.drives || ["C:\\"]
                        setDirs(items.map(d => ({ name: d, path: d, isDrive: true })))
                        setCurrentPath("我的电脑")
                        setParentPath(null)
                      } catch {}
                    }}
                      className="w-full text-left px-3 py-2 text-[11px] transition-colors"
                      style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-light)" }}>
                      我的电脑
                    </button>

                    {dirs.length === 0 && !loadingDirs && (
                      <p className="text-[10px] text-center py-6" style={{ color: "var(--text-tertiary)" }}>
                        没有子文件夹
                      </p>
                    )}
                    {dirs.map((d, i) => (
                      <div key={d.path || i} className="flex items-center gap-1 px-2 pr-1">
                        <button onClick={() => loadDir(d.path)}
                          className="flex-1 text-left px-3 py-2 text-[11px] truncate transition-colors"
                          style={{ color: "var(--text-primary)" }}>
                          {d.name}
                        </button>
                        <button onClick={() => selectDir(d.path)}
                          className="shrink-0 text-[9px] px-2 py-1 rounded transition-colors"
                          style={{ color: "#D85A30" }}
                          title="选择此文件夹">
                          选择
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* API Key */}
              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  API 密钥
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs transition-colors"
                  style={{
                    background: "var(--bg-surface-hover)",
                    border: "1px solid var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="sk-xxxxxxxxxxxx"
                />
                <p className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                  留空则使用后端 .env 配置的密钥
                </p>
              </div>

              {/* API Base URL */}
              <div>
                <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  API 地址
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-xs transition-colors"
                  style={{
                    background: "var(--bg-surface-hover)",
                    border: "1px solid var(--border-light)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="https://apihub.agnes-ai.com/v1"
                />
              </div>

              <a href="https://platform.agnes-ai.com/settings/apiKeys" target="_blank" rel="noopener noreferrer"
                className="block text-[10px] transition-colors"
                style={{ color: "var(--text-tertiary)" }}>
                获取 API 密钥 →
              </a>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave}
                  className="flex-1 text-xs font-medium py-2 rounded-lg transition-colors"
                  style={{
                    background: "#D85A30",
                    color: "#fff",
                    ...(firstRun ? { animation: "pulse 2s infinite" } : {}),
                  }}>
                  {firstRun ? "开始使用" : "保存"}
                </button>
                {!firstRun && (
                  <button onClick={handleClear}
                    className="text-xs font-medium py-2 px-4 rounded-lg border transition-colors"
                    style={{
                      background: "var(--bg-surface-hover)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }}>
                    清除
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
