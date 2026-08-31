import { Menu } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SidebarNavContent } from '@/components/layout/Sidebar'

export function MobileSidebar() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
        <Menu className="size-4" />
        <span className="sr-only">{t('layout.openNavigation')}</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-sidebar px-3 py-4">
        <SheetTitle className="sr-only">{t('layout.navigation')}</SheetTitle>
        <SidebarNavContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
