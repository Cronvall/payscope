interface ResizeHandleProps {
  onResize: (delta: number) => void
  direction: 'horizontal'
}

export default function ResizeHandle({ onResize }: ResizeHandleProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    let prevX = e.clientX

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - prevX
      prevX = moveEvent.clientX
      onResize(delta)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={handleMouseDown}
      className="group flex w-1.5 shrink-0 cursor-col-resize flex-col items-center justify-center bg-canvas transition-colors hover:bg-zinc-700"
    >
      <div className="flex h-full w-0.5 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="block h-1 w-full rounded-full bg-zinc-500" />
        <span className="block h-1 w-full rounded-full bg-zinc-500" />
        <span className="block h-1 w-full rounded-full bg-zinc-500" />
      </div>
    </div>
  )
}
