import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useInvoices } from '@/features/billing/hooks/useBilling'
import type { BillingInvoice, InvoiceStatus } from '@/types'

const STATUS_VARIANT: Record<InvoiceStatus, 'secondary' | 'destructive' | 'outline'> = {
  paid: 'secondary',
  open: 'outline',
  draft: 'outline',
  uncollectible: 'destructive',
  void: 'destructive',
}

// Fixed to 'en-US' rather than the viewer's own locale, matching the rest
// of the billing page (see formatEuro in lib/planPricing.ts) -- prices
// here are always shown the same way regardless of who's looking.
function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
    amountCents / 100
  )
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString()
}

function InvoiceRow({ invoice }: { invoice: BillingInvoice }) {
  const { t } = useTranslation()

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{formatDate(invoice.created)}</TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
      </TableCell>
      <TableCell>{formatAmount(invoice.amount_paid, invoice.currency)}</TableCell>
      <TableCell>
        {invoice.status && <Badge variant={STATUS_VARIANT[invoice.status]}>{t(`billing.history.statuses.${invoice.status}`)}</Badge>}
      </TableCell>
      <TableCell>
        {invoice.hosted_invoice_url && (
          <a
            href={invoice.hosted_invoice_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('billing.history.viewInvoice')}
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </TableCell>
    </TableRow>
  )
}

/**
 * A quick in-app glance at past charges. Not a source of truth -- the data
 * is fetched live from Stripe on every load (see StripeBillingService::
 * listInvoices on the backend), nothing is stored locally. "Manage billing"
 * (Stripe's own Customer Portal) remains the place to actually download a
 * receipt for accounting purposes; the links here open that same document.
 */
export function PaymentHistoryCard({ workspaceId }: { workspaceId: number }) {
  const { t } = useTranslation()
  const { data, isLoading } = useInvoices(workspaceId, true)

  if (isLoading) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('billing.history.title')}</CardTitle>
        <CardDescription>{t('billing.history.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {data?.unavailable ? (
          <p className="text-sm text-muted-foreground">{t('billing.history.unavailable')}</p>
        ) : !data?.invoices.length ? (
          <p className="text-sm text-muted-foreground">{t('billing.history.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('billing.history.date')}</TableHead>
                <TableHead>{t('billing.history.period')}</TableHead>
                <TableHead>{t('billing.history.amount')}</TableHead>
                <TableHead>{t('billing.history.status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.invoices.map((invoice) => (
                <InvoiceRow key={`${invoice.number}-${invoice.created}`} invoice={invoice} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
