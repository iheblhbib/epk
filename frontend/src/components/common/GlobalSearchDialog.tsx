import { useQuery } from '@tanstack/react-query'
import { FileText, Loader2, Mic2, Search, Sparkles, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { searchWorkspace } from '@/api/search'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import type { GlobalSearchResults } from '@/types'

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

function useGlobalSearch(workspaceId: number | undefined, query: string) {
  const debouncedQuery = useDebouncedValue(query.trim(), 250)

  return useQuery({
    queryKey: ['workspaces', workspaceId ?? 0, 'search', debouncedQuery],
    queryFn: () => searchWorkspace(workspaceId as number, debouncedQuery),
    enabled: workspaceId !== undefined && debouncedQuery.length >= 2,
    placeholderData: (previous) => previous,
  })
}

function ResultGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  )
}

function ResultRow({ icon, title, subtitle, onClick }: { icon: ReactNode; title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-sm outline-none hover:bg-muted focus-visible:bg-muted"
    >
      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-foreground">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </button>
  )
}

function ResultGroups({ results, onNavigate }: { results: GlobalSearchResults; onNavigate: (path: string) => void }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      {results.epks.length > 0 && (
        <ResultGroup label={t('search.groups.epks')}>
          {results.epks.map((epk) => (
            <ResultRow
              key={epk.id}
              icon={<Sparkles className="size-4" />}
              title={epk.title}
              subtitle={t(`epks.status.${epk.status}`)}
              onClick={() => onNavigate(`/epks/${epk.id}/builder`)}
            />
          ))}
        </ResultGroup>
      )}
      {results.artists.length > 0 && (
        <ResultGroup label={t('search.groups.artists')}>
          {results.artists.map((artist) => (
            <ResultRow key={artist.id} icon={<Mic2 className="size-4" />} title={artist.name} onClick={() => onNavigate('/epks')} />
          ))}
        </ResultGroup>
      )}
      {results.contacts.length > 0 && (
        <ResultGroup label={t('search.groups.contacts')}>
          {results.contacts.map((contact) => (
            <ResultRow
              key={contact.id}
              icon={<Users className="size-4" />}
              title={contact.name}
              subtitle={contact.email ?? undefined}
              onClick={() => onNavigate('/contacts')}
            />
          ))}
        </ResultGroup>
      )}
      {results.media.length > 0 && (
        <ResultGroup label={t('search.groups.media')}>
          {results.media.map((item) => (
            <ResultRow
              key={item.id}
              icon={
                item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt="" className="size-full object-cover" />
                ) : (
                  <FileText className="size-4" />
                )
              }
              title={item.filename}
              onClick={() => onNavigate('/media')}
            />
          ))}
        </ResultGroup>
      )}
    </div>
  )
}

export function GlobalSearchDialog() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentWorkspace } = useCurrentWorkspace()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data, isFetching } = useGlobalSearch(open ? currentWorkspace?.id : undefined, query)

  const hasResults = !!data && (data.epks.length + data.artists.length + data.contacts.length + data.media.length > 0)

  const goTo = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <Search className="size-4" />
        <span className="sr-only">{t('search.trigger')}</span>
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 p-0" showCloseButton={false}>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('search.hint')}</p>
          ) : isFetching && !data ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : data && !hasResults ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('search.empty')}</p>
          ) : (
            data && <ResultGroups results={data} onNavigate={goTo} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
