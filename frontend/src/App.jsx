import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AppProvider } from "./store/AppContext"
import Studio from "./pages/Studio"
import PromptOptimize from "./pages/PromptOptimize"
import ImageGenerate from "./pages/ImageGenerate"
import VideoGenerate from "./pages/VideoGenerate"
import WorkflowBuilder from "./pages/WorkflowBuilder"
import BatchExecute from "./pages/BatchExecute"
import OutputGallery from "./pages/OutputGallery"

const Layout = ({ children }) => (
  <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
    <main className="p-6">{children}</main>
  </div>
)

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Studio = default home */}
          <Route path="/" element={<Studio />} />

          {/* Tool pages */}
          <Route path="/tools/chat" element={<Layout><PromptOptimize /></Layout>} />
          <Route path="/tools/images" element={<Layout><ImageGenerate /></Layout>} />
          <Route path="/tools/video" element={<Layout><VideoGenerate /></Layout>} />
          <Route path="/tools/workflow" element={<Layout><WorkflowBuilder /></Layout>} />
          <Route path="/tools/batch" element={<Layout><BatchExecute /></Layout>} />
          <Route path="/tools/gallery" element={<Layout><OutputGallery /></Layout>} />

          {/* Old path redirects */}
          <Route path="/images" element={<Navigate to="/tools/images" replace />} />
          <Route path="/video" element={<Navigate to="/tools/video" replace />} />
          <Route path="/workflow" element={<Navigate to="/tools/workflow" replace />} />
          <Route path="/batch" element={<Navigate to="/tools/batch" replace />} />
          <Route path="/gallery" element={<Navigate to="/tools/gallery" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
