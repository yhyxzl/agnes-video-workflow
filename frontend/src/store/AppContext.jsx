import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

const AppContext = createContext(null)

const STORAGE_KEY_CHAT = "agnes_chat_history"
const STORAGE_KEY_PROMPTS = "agnes_prompt_history"
const STORAGE_KEY_IMAGES = "agnes_image_history"
const STORAGE_KEY_VIDEOS = "agnes_video_history"
const STORAGE_KEY_SETTINGS = "agnes_settings"

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function AppProvider({ children }) {
  // ─── 聊天记录 ───
  // session = { id, title, messages: [{role, content}], updatedAt }
  const [chatSessions, setChatSessions] = useState(() => loadJSON(STORAGE_KEY_CHAT, []))
  const [activeSessionId, setActiveSessionId] = useState(null)

  // ─── 提示词历史 ───
  // record = { id, original, optimized, createdAt }
  const [promptHistory, setPromptHistory] = useState(() => loadJSON(STORAGE_KEY_PROMPTS, []))

  // ─── 图片历史 ───
  // record = { id, prompt, url, size, createdAt }
  const [imageHistory, setImageHistory] = useState(() => loadJSON(STORAGE_KEY_IMAGES, []))

  // ─── 视频历史 ───
  // record = { id, prompt, imageUrl, promptId, status, videoUrl, createdAt }
  const [videoHistory, setVideoHistory] = useState(() => loadJSON(STORAGE_KEY_VIDEOS, []))

  // ─── API 设置 ───
  // { apiKey, baseUrl }
  const [apiSettings, setApiSettings] = useState(() => loadJSON(STORAGE_KEY_SETTINGS, {}))

  // ─── 自动持久化 ───
  useEffect(() => { localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(chatSessions)) }, [chatSessions])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PROMPTS, JSON.stringify(promptHistory)) }, [promptHistory])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_IMAGES, JSON.stringify(imageHistory)) }, [imageHistory])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_VIDEOS, JSON.stringify(videoHistory)) }, [videoHistory])
  useEffect(() => { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(apiSettings)) }, [apiSettings])

  const activeSession = chatSessions.find(s => s.id === activeSessionId) || null

  // ── Chat Session CRUD ──
  const createSession = useCallback(() => {
    const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const session = {
      id,
      title: "新对话",
      messages: [],
      updatedAt: new Date().toISOString(),
    }
    setChatSessions(prev => {
      const next = [session, ...prev]
      return next
    })
    setActiveSessionId(id)
    return id
  }, [])

  const deleteSession = useCallback((id) => {
    setChatSessions(prev => prev.filter(s => s.id !== id))
    setActiveSessionId(prev => prev === id ? null : prev)
  }, [])

  const renameSession = useCallback((id, title) => {
    setChatSessions(prev => prev.map(s =>
      s.id === id ? { ...s, title, updatedAt: new Date().toISOString() } : s
    ))
  }, [])

  const addMessage = useCallback((sessionId, message) => {
    setChatSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s
      const newMessages = [...s.messages, message]
      const firstUserMsg = newMessages.find(m => m.role === "user")
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "")
        : "新对话"
      return { ...s, messages: newMessages, title, updatedAt: new Date().toISOString() }
    }))
  }, [])

  // ── 提示词历史 CRUD ──
  const addPromptRecord = useCallback((original, optimized) => {
    const record = {
      id: `prompt_${Date.now()}`,
      original,
      optimized,
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    }
    setPromptHistory(prev => [record, ...prev])
    return record
  }, [])

  const deletePromptRecord = useCallback((id) => {
    setPromptHistory(prev => prev.filter(r => r.id !== id))
  }, [])

  const clearPromptHistory = useCallback(() => {
    setPromptHistory([])
  }, [])

  // ── 图片历史 CRUD ──
  const addImageRecord = useCallback((prompt, url, size) => {
    const record = {
      id: `img_${Date.now()}`,
      prompt,
      url,
      size,
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    }
    setImageHistory(prev => [record, ...prev])
    return record
  }, [])

  const clearChatHistory = useCallback(() => {
    setChatSessions([])
    setActiveSessionId(null)
  }, [])

  const clearImageHistory = useCallback(() => {
    setImageHistory([])
  }, [])

  // ── 视频历史 CRUD ──
  const addVideoRecord = useCallback((prompt, imageUrl, promptId, status) => {
    const record = {
      id: `vid_${Date.now()}`,
      prompt,
      imageUrl: imageUrl || null,
      promptId,
      status,
      videoUrl: null,
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    }
    setVideoHistory(prev => [record, ...prev])
    return record
  }, [])

  const updateVideoRecord = useCallback((id, updates) => {
    setVideoHistory(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }, [])

  const clearVideoHistory = useCallback(() => {
    setVideoHistory([])
  }, [])

  const contextValue = {
    // Chat
    chatSessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    createSession,
    deleteSession,
    renameSession,
    addMessage,
    clearChatHistory,

    // Prompts
    promptHistory,
    addPromptRecord,
    deletePromptRecord,
    clearPromptHistory,

    // Images
    imageHistory,
    addImageRecord,
    clearImageHistory,

    // Videos
    videoHistory,
    addVideoRecord,
    updateVideoRecord,
    clearVideoHistory,

    // API Settings
    apiSettings,
    setApiSettings,
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}

export default AppContext
