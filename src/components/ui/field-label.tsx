"use client"

import { cn } from "@/lib/utils"

export interface FieldLabelProps {
  children: React.ReactNode
  htmlFor?: string
  required?: boolean
  className?: string
}

export function FieldLabel({
  children,
  htmlFor,
  required,
  className
}: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        // Accessible contrast: gray-600 = 5.7:1 on white
        "text-sm font-medium text-gray-600",
        // Dark mode accessible: gray-400 on dark background
        "dark:text-gray-400",
        "mb-1 block",
        className
      )}
    >
      {children}
      {required && (
        <span className="text-red-600 dark:text-red-400 ml-0.5" aria-label="required">
          *
        </span>
      )}
    </label>
  )
}
