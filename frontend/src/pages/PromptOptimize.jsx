import React, { useState, useRef, useEffect } from "react"
import { chat } from "../store/api"
import { useApp } from "../store/AppContext"

const SYSTEM_PROMPT = "你是一位专业的视频/图像生成提示词优化专家。请根据用户的需求，生成高质量、详细、视觉丰富的提示词。输出语言应与用户输入语言一致。"

export default function PromptOptimize() {
  const {
    chatSessions, activeSession, activeSessionId,
    setActiveSessionId, createSession, deleteSession, addMessage,
    promptHistory, addPromptRecord, deletePromptRecord, clearPromptHistory,
  } = useApp()

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [optimizedPrompt, setOptimizedPrompt] = useState("")
  const messagesEndRef = useRef(null)

  // Auto-create first session
  useEffect(() => {
    if (chatSessions.length === 0) {
      createSession()
    } else if (!activeSessionId) {
      setActiveSessionId(chatSessions[0].id)
    }
  }, [chatSessions.length, activeSessionId, createSession, setActiveSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeSession?.messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = createSession()
    }

    const userMsg = { role: "user", content: input.trim() }
    const currentInput = input.trim()
    addMessage(sessionId, userMsg)
    setInput("")
    setLoading(true)

    const session = chatSessions.find(s => s.id === sessionId) || { messages: [] }
    const contextMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...session.messages.slice(-20), // last 20 messages for context
      userMsg,
    ]

    try {
      const res = await chat(contextMessages)
      const reply = res.choices[0]?.message?.content || "生成失败，请重试"
      addMessage(sessionId, { role: "assistant", content: reply })
      setOptimizedPrompt(reply)
      // Save to prompt history
      addPromptRecord(currentInput, reply)
    } catch (err) {
      addMessage(sessionId, { role: "assistant", content: `错误: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const displayMessages = activeSession?.messages || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-100 mb-1">提示词优化</h2>
          <p className="text-dark-400 text-sm">与 AI 对话，优化你的视频/图像生成提示词（页面切换不丢失）</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ─── Sidebar: Session list ─── */}
        <div className="lg:col-span-1 bg-dark-800 rounded-xl border border-dark-600 flex flex-col" style={{ height: "600px" }}>
          <div className="px-3 py-2.5 border-b border-dark-600 flex items-center justify-between">
            <span className="text-xs font-semibold text-dark-400 uppercase tracking-wider">对话列表</span>
            <button
              onClick={createSession}
              className="text-brand-400 hover:text-brand-300 text-xs font-medium transition-colors"
            >
              + 新建
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chatSessions.length === 0 && (
              <div className="text-center text-dark-600 text-xs py-8">暂无对话</div>
            )}
            {chatSessions.map(session => (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                  session.id === activeSessionId
                    ? "bg-brand-600/20 text-brand-300 border border-brand-600/30"
                    : "text-dark-400 hover:bg-dark-700 hover:text-dark-200 border border-transparent"
                }`}
              >
                <span className="truncate flex-1">{session.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                  className="opacity-0 group-hover:opacity-100 text-dark-500 hover:text-red-400 transition-all ml-2 shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Chat Panel ─── */}
        <div className="lg:col-span-2 bg-dark-800 rounded-xl border border-dark-600 flex flex-col" style={{ height: "600px" }}>
          <div className="px-4 py-2.5 border-b border-dark-600">
            <span className="text-xs text-dark-400">
              {activeSession ? activeSession.title : "无活跃对话"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {displayMessages.length === 0 && (
              <div className="flex items-center justify-center h-full text-dark-600 text-sm">
                在下方输入内容开始对话
              </div>
            )}
            {displayMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-dark-700 text-dark-300"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-dark-700 rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-dark-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-dark-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-dark-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 border-t border-dark-600">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述你想生成的视频/图像内容..."
                className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 text-dark-200 placeholder-dark-500"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white px-5 rounded-lg text-sm font-medium transition-colors"
              >
                发送
              </button>
            </div>
          </div>
        </div>

        {/* ─── Right Panel: Optimization Result + History ─── */}
        <div className="lg:col-span-1 bg-dark-800 rounded-xl border border-dark-600 flex flex-col" style={{ height: "600px" }}>
          <div className="px-4 py-2.5 border-b border-dark-600">
            <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider">优化历史</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {promptHistory.length === 0 ? (
              <div className="flex items-center justify-center h-full text-dark-600 text-sm">
                暂无优化记录
              </div>
            ) : (
              <>
                <div className="flex justify-end mb-1">
                  <button
                    onClick={clearPromptHistory}
                    className="text-[10px] text-dark-500 hover:text-red-400 transition-colors"
                  >
                    清空全部
                  </button>
                </div>
                {promptHistory.map((record, i) => (
                  <div key={record.id} className="bg-dark-700 rounded-lg p-3 border border-dark-600">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-dark-500">{record.createdAt}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(record.optimized)
                          deletePromptRecord(record.id)
                        }}
                        className="text-[10px] text-brand-500 hover:text-brand-400 transition-colors"
                      >
                        复制并删除
                      </button>
                    </div>
                    <p className="text-[11px] text-dark-400 line-clamp-1 mb-1">原: {record.original}</p>
                    <p className="text-xs text-dark-200 line-clamp-3 leading-relaxed">{record.optimized}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
