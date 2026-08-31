import { ArrowLeft, Download, ExternalLink, Loader2, Monitor, Share2, Smartphone, Sparkles, Tablet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { AddSectionMenu } from '@/features/epks/builder/AddSectionMenu'
import { CustomDomainDialog } from '@/features/epks/builder/CustomDomainDialog'
import { LivePreview } from '@/features/epks/builder/LivePreview'
import { PrivateLinksDialog } from '@/features/epks/builder/PrivateLinksDialog'
import { SectionCommentsPanel } from '@/features/epks/builder/SectionCommentsPanel'
import { SectionList } from '@/features/epks/builder/SectionList'
import { SectionSettingsPanel } from '@/features/epks/builder/SectionSettingsPanel'
import { ThemePanel } from '@/features/epks/builder/ThemePanel'
import { useEpk } from '@/features/epks/hooks/useEpks'
import { useSections } from '@/features/epks/hooks/useEpkSections'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { downloadAuthenticatedFile } from '@/lib/downloadFile'
import { isAdminLevel, isEditorLevel } from '@/lib/permissions'
import { cn } from '@/lib/utils'

type DeviceWidth = 'desktop' | 'tablet' | 'mobile'

const DEVICE_WIDTH_CLASS: Record<DeviceWidth, string> = {
  desktop: 'max-w-4xl',
  tablet: 'max-w-xl',
  mobile: 'max-w-sm',
}

const DEVICE_OPTIONS: { value: DeviceWidth; icon: typeof Monitor; labelKey: string }[] = [
  { value: 'desktop', icon: Monitor, labelKey: 'epkBuilder.device.desktop' },
  { value: 'tablet', icon: Tablet, labelKey: 'epkBuilder.device.tablet' },
  { value: 'mobile', icon: Smartphone, labelKey: 'epkBuilder.device.mobile' },
]

export function EpkBuilderPage() {
  const { t } = useTranslation()
  const params = useParams<{ epkId: string }>()
  const epkId = Number(params.epkId)
  const { data: epk, isLoading: epkLoading } = useEpk(epkId)
  const { data: sections, isLoading: sectionsLoading } = useSections(epkId)
  const { currentWorkspace } = useCurrentWorkspace()
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null)
  const [deviceWidth, setDeviceWidth] = useState<DeviceWidth>('desktop')
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const canEdit = isEditorLevel(currentWorkspace?.my_role)
  const canModerateComments = isAdminLevel(currentWorkspace?.my_role)

  if (epkLoading || sectionsLoading) {
    return <CardGridSkeleton />
  }

  if (!epk || !sections) {
    return (
      <EmptyState
        icon={Sparkles}
        title={t('epkBuilder.notFound.title')}
        description={t('epkBuilder.notFound.description')}
      />
    )
  }

  // Default to the first section (by position) so the panel isn't blank on
  // first open, without needing an effect to synchronize it into state.
  const orderedSections = [...sections].sort((a, b) => a.position - b.position)
  const effectiveSelectedId = selectedSectionId ?? orderedSections[0]?.id ?? null
  const selectedSection = orderedSections.find((section) => section.id === effectiveSelectedId) ?? null

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link to="/epks" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="font-heading text-lg font-semibold text-foreground">{epk.title}</h1>
            <p className="text-xs text-muted-foreground">{epk.artist?.name ?? t('epks.noArtist')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && <PrivateLinksDialog epkId={epkId} />}
          {canEdit && <CustomDomainDialog epk={epk} />}

          <Button
            variant="outline"
            size="sm"
            disabled={isDownloadingPdf}
            // Not a plain <a href={backendUrl} target="_blank"> — that was
            // the original implementation, and it 401s despite a perfectly
            // valid session. Sanctum's SPA auth only reads the session
            // cookie for a request it recognizes as coming from the
            // frontend, decided from the Referer/Origin header, and a
            // target="_blank" navigation to a different-port URL doesn't
            // reliably send either (confirmed via a raw request dump:
            // sec-fetch-site: none, no referer, no origin — even with the
            // cookie itself right there in the request). Routing through
            // this app's own axios client sidesteps that fragile heuristic
            // entirely, the same way every other authenticated call here
            // already does.
            onClick={() => {
              setIsDownloadingPdf(true)
              downloadAuthenticatedFile(`/api/epks/${epkId}/pdf`, 'epk.pdf')
                .catch(() => toast.error(t('epkBuilder.downloadPdfError')))
                .finally(() => setIsDownloadingPdf(false))
            }}
          >
            {isDownloadingPdf ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {t('epkBuilder.downloadPdf')}
          </Button>

          {epk.status === 'published' ? (
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={epk.public_url} target="_blank" rel="noopener" />}>
              <ExternalLink className="size-4" />
              {t('epkBuilder.viewPublicPage')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled title={t('epkBuilder.viewPublicPageDisabledTitle')}>
              <ExternalLink className="size-4" />
              {t('epkBuilder.viewPublicPage')}
            </Button>
          )}

          {epk.share_url ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(epk.share_url!)
                toast.success(t('epkBuilder.shareLinkCopied'))
              }}
            >
              <Share2 className="size-4" />
              {t('epkBuilder.copyShareLink')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled title={t('epkBuilder.shareLinkDisabledTitle')}>
              <Share2 className="size-4" />
              {t('epkBuilder.copyShareLink')}
            </Button>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {DEVICE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={deviceWidth === option.value ? 'secondary' : 'ghost'}
                size="icon-sm"
                title={t(option.labelKey)}
                onClick={() => setDeviceWidth(option.value)}
              >
                <option.icon className="size-4" />
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_320px]">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-3">
          {canEdit && <AddSectionMenu epkId={epkId} sections={sections} onAdded={setSelectedSectionId} />}
          <SectionList
            epkId={epkId}
            sections={sections}
            selectedSectionId={effectiveSelectedId}
            onSelectSection={setSelectedSectionId}
            canEdit={canEdit}
          />
        </div>

        <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-muted/30 p-4">
          <div className={cn('mx-auto overflow-hidden rounded-xl border border-border shadow-sm', DEVICE_WIDTH_CLASS[deviceWidth])}>
            <LivePreview
              epk={epk}
              workspaceId={epk.workspace_id}
              sections={sections}
              selectedSectionId={effectiveSelectedId}
              onSelectSection={setSelectedSectionId}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-border bg-card">
          <Tabs defaultValue="section" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-2">
              <TabsTrigger value="section">{t('epkBuilder.tabs.section')}</TabsTrigger>
              <TabsTrigger value="comments">{t('epkBuilder.tabs.comments')}</TabsTrigger>
              <TabsTrigger value="theme">{t('epkBuilder.tabs.theme')}</TabsTrigger>
            </TabsList>
            <TabsContent value="section" className="min-h-0 flex-1 overflow-y-auto">
              <SectionSettingsPanel
                epkId={epkId}
                workspaceId={epk.workspace_id}
                section={selectedSection}
                canEdit={canEdit}
              />
            </TabsContent>
            <TabsContent value="comments" className="min-h-0 flex-1 overflow-y-auto">
              <SectionCommentsPanel epkId={epkId} section={selectedSection} canModerate={canModerateComments} />
            </TabsContent>
            <TabsContent value="theme" className="min-h-0 flex-1 overflow-y-auto">
              <ThemePanel epk={epk} canEdit={canEdit} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
