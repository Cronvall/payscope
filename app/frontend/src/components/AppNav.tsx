import { NavLink } from 'react-router-dom'

export default function AppNav() {
  return (
    <nav className="flex shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2">
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `rounded px-3 py-1.5 font-mono text-sm transition-colors ${
            isActive ? 'bg-accent/20 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
          }`
        }
      >
        Workspace
      </NavLink>
      <NavLink
        to="/cases"
        className={({ isActive }) =>
          `rounded px-3 py-1.5 font-mono text-sm transition-colors ${
            isActive ? 'bg-accent/20 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
          }`
        }
      >
        Recovery Board
      </NavLink>
    </nav>
  )
}
