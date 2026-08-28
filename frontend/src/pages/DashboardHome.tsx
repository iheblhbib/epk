import { Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { EpkFormDialog } from '@/features/epks/components/EpkFormDialog'
import { useEpks } from '@/features/epks/hooks/useEpks'
import { CreateWorkspaceDialog } from '@/features/workspaces/components/CreateWorkspaceDialog'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { useAuth } from '@/providers/AuthProvider'

export function DashboardHome() {
  const { user } = useAuth()
  const { currentWorkspace, isLoading, setCurrentWorkspaceId } = useCurrentWorkspace()
  const { data: epks } = useEpks(currentWorkspace?.id)
  const firstName = user?.name.split(' ')[0]

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (!currentWorkspace) {
    return (
      <EmptyState
        icon={Sparkles}
        title={`Welcome to Kitfolio${firstName ? `, ${firstName}` : ''}`}
        description="Create a workspace to start building your first press kit."
        action={
          <CreateWorkspaceDialog
            trigger={
              <Button>
                <Plus className="size-4" />
                Create your first workspace
              </Button>
            }
            onCreated={setCurrentWorkspaceId}
          />
        }
      />
    )
  }

  const stats = [
    { label: 'Total EPKs', value: String(epks?.length ?? 0) },
    { label: 'Published EPKs', value: String(epks?.filter((epk) => epk.status === 'published').length ?? 0) },
    { label: 'Total views', value: '0' },
    { label: 'Downloads', value: '0' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening in {currentWorkspace.name}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="font-heading text-2xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {epks?.length === 0 && (
        <EmptyState
          icon={Sparkles}
          title="No EPKs yet"
          description="Create your first press kit to get started. The visual builder for sections and theming arrives in a later phase."
          action={
            <EpkFormDialog
              workspaceId={currentWorkspace.id}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Create your first EPK
                </Button>
              }
            />
          }
        />
      )}
    </div>
  )
}
