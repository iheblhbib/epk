import { Check, X } from "lucide-react"

import { PASSWORD_REQUIREMENTS } from "@/lib/passwordStrength"
import { cn } from "@/lib/utils"

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.test(password)

        return (
          <li
            key={requirement.id}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              met ? "text-success" : "text-muted-foreground"
            )}
          >
            {met ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
            {requirement.label}
          </li>
        )
      })}
    </ul>
  )
}
