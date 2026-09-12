const PALETTE = ['#cc1417', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

export function WorkspaceAvatar({ id, name, logoUrl }: { id: number; name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} className="size-6 shrink-0 rounded-md object-cover" />
  }

  const color = PALETTE[id % PALETTE.length]

  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
