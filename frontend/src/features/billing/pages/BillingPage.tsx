import { AlertTriangle, Check, CreditCard, Loader2, Minus } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import { UsageBar } from '@/features/billing/components/UsageBar'
import { useBilling, useCreateCheckoutSession, useCreatePortalSession } from '@/features/billing/hooks/useBilling'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { formatBytes } from '@/lib/formatBytes'
import { isAdminLevel } from '@/lib/permissions'
import type { BillingData, PlanDetails, SubscriptionPlan } from '@/types'
import type { TFunction } from 'i18next'

const PLAN_ORDER: SubscriptionPlan[] = ['free', 'pro', 'business']

const FEATURE_ROW_KEYS: { key: keyof PlanDetails; labelKey: string }[] = [
  { key: 'custom_themes', labelKey: 'billing.features.customThemes' },
  { key: 'private_links', labelKey: 'billing.features.privateLinks' },
  { key: 'white_label', labelKey: 'billing.features.whiteLabel' },
  { key: 'custom_domains', labelKey: 'billing.features.customDomains' },
]

function PlanCard({
  plan,
  isCurrent,
  canManage,
  onUpgrade,
  isUpgrading,
  t,
}: {
  plan: PlanDetails
  isCurrent: boolean
  canManage: boolean
  onUpgrade: () => void
  isUpgrading: boolean
  t: TFunction
}) {
  const canUpgradeToThis = !isCurrent && plan.plan !== 'free'

  return (
    <Card className={isCurrent ? 'border-primary ring-1 ring-primary' : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.label}</CardTitle>
          {isCurrent && <Badge>{t('billing.currentPlan')}</Badge>}
        </div>
        <CardDescription>
          {plan.max_epks === null ? t('billing.unlimitedEpks') : t('billing.epkCount', { count: plan.max_epks })} ·{' '}
          {plan.max_team_members === null
            ? t('billing.unlimitedTeamMembers')
            : t('billing.teamMemberCount', { count: plan.max_team_members })}{' '}
          · {formatBytes(plan.max_storage_bytes ?? 0)} {t('billing.storage')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 text-sm">
          {FEATURE_ROW_KEYS.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              {plan[row.key] ? (
                <Check className="size-4 shrink-0 text-success" />
              ) : (
                <Minus className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={plan[row.key] ? 'text-foreground' : 'text-muted-foreground'}>{t(row.labelKey)}</span>
            </li>
          ))}
        </ul>
        {canManage && canUpgradeToThis && (
          <Button size="sm" className="w-full" disabled={isUpgrading} onClick={onUpgrade}>
            {isUpgrading && <Loader2 className="size-4 animate-spin" />}
            {t('billing.upgradeTo', { plan: plan.label })}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function SubscriptionStatusBanner({ billing, t }: { billing: BillingData; t: TFunction }) {
  if (billing.subscription_status !== 'past_due') return null

  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertTriangle className="size-4 shrink-0" />
      {t('billing.pastDueWarning')}
    </div>
  )
}

export function BillingPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const { data: billing, isLoading } = useBilling(currentWorkspace?.id)
  const checkout = useCreateCheckoutSession(currentWorkspace?.id ?? 0)
  const portal = useCreatePortalSession(currentWorkspace?.id ?? 0)

  // Stripe redirects back here after Checkout — the actual plan change
  // itself only lands once the webhook fires (often a beat after this
  // redirect), so this is just an acknowledgement toast, not a source of
  // truth; useBilling() above will reflect the real state on its own once
  // the webhook has landed and this page is revisited or refetches.
  useEffect(() => {
    const checkoutResult = searchParams.get('checkout')
    if (!checkoutResult) return

    if (checkoutResult === 'success') {
      toast.success(t('billing.checkoutSuccess'))
    } else if (checkoutResult === 'canceled') {
      toast(t('billing.checkoutCanceled'))
    }

    const next = new URLSearchParams(searchParams)
    next.delete('checkout')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (workspaceLoading || isLoading) {
    return <CardGridSkeleton />
  }

  if (!currentWorkspace || !billing) {
    return (
      <EmptyState
        icon={CreditCard}
        title={t('common.noWorkspaceYet')}
        description={t('billing.emptyState.noWorkspaceDescription')}
      />
    )
  }

  const canManage = isAdminLevel(currentWorkspace.my_role)

  const startCheckout = (plan: Extract<SubscriptionPlan, 'pro' | 'business'>) => {
    checkout.mutate(plan, {
      onSuccess: (url) => {
        window.location.href = url
      },
      onError: () => toast.error(t('billing.checkoutError')),
    })
  }

  const openPortal = () => {
    portal.mutate(undefined, {
      onSuccess: (url) => {
        window.location.href = url
      },
      onError: () => toast.error(t('billing.portalError')),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{t('nav.billing')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('billing.pageDescription', { workspace: currentWorkspace.name, plan: billing.plans[billing.plan].label })}
          </p>
        </div>
        {canManage && billing.has_stripe_customer && (
          <Button variant="outline" size="sm" disabled={portal.isPending} onClick={openPortal}>
            {portal.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('billing.manageBilling')}
          </Button>
        )}
      </div>

      <SubscriptionStatusBanner billing={billing} t={t} />

      <Card>
        <CardHeader>
          <CardTitle>{t('billing.usage.title')}</CardTitle>
          <CardDescription>{t('billing.usage.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageBar label={t('billing.usage.epks')} used={billing.usage.epks.used} limit={billing.usage.epks.limit} />
          <UsageBar
            label={t('billing.usage.teamMembers')}
            used={billing.usage.team_members.used}
            limit={billing.usage.team_members.limit}
          />
          <UsageBar
            label={t('billing.usage.storage')}
            used={billing.usage.storage_bytes.used}
            limit={billing.usage.storage_bytes.limit}
            formatValue={formatBytes}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">{t('billing.plans')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((plan) => (
            <PlanCard
              key={plan}
              plan={billing.plans[plan]}
              isCurrent={plan === billing.plan}
              canManage={canManage}
              isUpgrading={checkout.isPending && checkout.variables === plan}
              onUpgrade={() => startCheckout(plan as Extract<SubscriptionPlan, 'pro' | 'business'>)}
              t={t}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
