import { Check, CreditCard, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { UsageBar } from '@/features/billing/components/UsageBar'
import { useBilling } from '@/features/billing/hooks/useBilling'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { formatBytes } from '@/lib/formatBytes'
import type { PlanDetails, SubscriptionPlan } from '@/types'

const PLAN_ORDER: SubscriptionPlan[] = ['free', 'pro', 'business']

const FEATURE_ROWS: { key: keyof PlanDetails; label: string }[] = [
  { key: 'custom_themes', label: 'Custom theme overrides' },
  { key: 'private_links', label: 'Private share links' },
  { key: 'white_label', label: 'White-label branding' },
  { key: 'custom_domains', label: 'Custom domains' },
]

function PlanCard({ plan, isCurrent }: { plan: PlanDetails; isCurrent: boolean }) {
  return (
    <Card className={isCurrent ? 'border-primary ring-1 ring-primary' : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.label}</CardTitle>
          {isCurrent && <Badge>Current plan</Badge>}
        </div>
        <CardDescription>
          {plan.max_epks === null ? 'Unlimited EPKs' : `${plan.max_epks} EPK${plan.max_epks === 1 ? '' : 's'}`} ·{' '}
          {plan.max_team_members === null ? 'Unlimited team members' : `${plan.max_team_members} team members`} ·{' '}
          {formatBytes(plan.max_storage_bytes ?? 0)} storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 text-sm">
          {FEATURE_ROWS.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              {plan[row.key] ? (
                <Check className="size-4 shrink-0 text-success" />
              ) : (
                <Minus className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={plan[row.key] ? 'text-foreground' : 'text-muted-foreground'}>{row.label}</span>
            </li>
          ))}
        </ul>
        {!isCurrent && (
          <p className="pt-1 text-xs text-muted-foreground">
            Contact us to move this workspace to {plan.label}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function BillingPage() {
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const { data: billing, isLoading } = useBilling(currentWorkspace?.id)

  if (workspaceLoading || isLoading) {
    return <CardGridSkeleton />
  }

  if (!currentWorkspace || !billing) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No workspace yet"
        description="Create a workspace from the dashboard to see billing details."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground">
          {currentWorkspace.name} is on the {billing.plans[billing.plan].label} plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>What this workspace is using against its plan limits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageBar label="EPKs" used={billing.usage.epks.used} limit={billing.usage.epks.limit} />
          <UsageBar label="Team members" used={billing.usage.team_members.used} limit={billing.usage.team_members.limit} />
          <UsageBar
            label="Storage"
            used={billing.usage.storage_bytes.used}
            limit={billing.usage.storage_bytes.limit}
            formatValue={formatBytes}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((plan) => (
            <PlanCard key={plan} plan={billing.plans[plan]} isCurrent={plan === billing.plan} />
          ))}
        </div>
      </div>
    </div>
  )
}
