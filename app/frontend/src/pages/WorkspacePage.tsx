import { useState, useCallback } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import StreamConsole from '../components/StreamConsole'
import ActionListPanel from '../components/ActionListPanel'
import ActionDetailPanel from '../components/ActionDetailPanel'
import ResizeHandle from '../components/ResizeHandle'

const MIN_LOG_WIDTH = 180
const MIN_ACTIONS_WIDTH = 240
const MIN_DETAIL_WIDTH = 320
const MAX_LOG_WIDTH = 500
const MAX_ACTIONS_WIDTH = 700
const DEFAULT_LOG_WIDTH = 280
const DEFAULT_ACTIONS_WIDTH = 360

export default function WorkspacePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [logWidth, setLogWidth] = useState(DEFAULT_LOG_WIDTH)
  const [actionsWidth, setActionsWidth] = useState(DEFAULT_ACTIONS_WIDTH)
  const {
    actionItems,
    dividendSeasonStreaming,
    errandsOptimized,
    streamLogs,
    selectedAction,
    setSelectedAction,
    startDividendSeason,
    stopDividendSeason,
    eventStreamPaused,
    togglePauseDividendSeason,
  } = useWorkspace()

  const clampLogWidth = useCallback(
    (w: number) => Math.max(MIN_LOG_WIDTH, Math.min(MAX_LOG_WIDTH, w)),
    []
  )
  const clampActionsWidth = useCallback(
    (w: number) => Math.max(MIN_ACTIONS_WIDTH, Math.min(MAX_ACTIONS_WIDTH, w)),
    []
  )

  return (
    <div className="flex h-full w-full">
      <div
        className="flex shrink-0 flex-col overflow-hidden"
        style={{ width: sidebarCollapsed ? 48 : logWidth, minWidth: sidebarCollapsed ? 48 : MIN_LOG_WIDTH }}
      >
        <StreamConsole
          logs={streamLogs}
          streaming={dividendSeasonStreaming}
          paused={eventStreamPaused}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onStart={startDividendSeason}
          onStop={stopDividendSeason}
          onPause={togglePauseDividendSeason}
        />
      </div>
      <ResizeHandle
        direction="horizontal"
        onResize={(delta) => setLogWidth((w) => clampLogWidth(w + delta))}
      />
      <div
        className="flex shrink-0 flex-col overflow-hidden"
        style={{ width: actionsWidth, minWidth: MIN_ACTIONS_WIDTH }}
      >
        <ActionListPanel
          actions={actionItems}
          selectedAction={selectedAction}
          onSelectAction={setSelectedAction}
          streaming={dividendSeasonStreaming}
          errandsOptimized={errandsOptimized}
        />
      </div>
      <ResizeHandle
        direction="horizontal"
        onResize={(delta) => setActionsWidth((w) => clampActionsWidth(w + delta))}
      />
      <div className="flex min-w-0 flex-1 flex-col" style={{ minWidth: MIN_DETAIL_WIDTH }}>
        <ActionDetailPanel />
      </div>
    </div>
  )
}
