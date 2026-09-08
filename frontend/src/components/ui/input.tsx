import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { useLocalControlledValue } from "@/hooks/useLocalControlledValue"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(function Input(
  { className, type, value, onChange, ...props },
  forwardedRef
) {
  // Only string values ever reach this component in practice (settings-panel
  // fields, react-hook-form's controlled `field.value`) -- an uncontrolled
  // caller (no `value` prop at all) skips the local buffer entirely and
  // renders straight through, same as a plain <input>.
  const isControlled = value !== undefined
  const local = useLocalControlledValue(isControlled ? String(value) : "")

  return (
    <InputPrimitive
      ref={forwardedRef}
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...(isControlled ? { value: local.value } : {})}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        if (isControlled) local.onChange(event.target.value)
        onChange?.(event)
      }}
      {...props}
    />
  )
})

export { Input }
