import { cn } from '@/shared/lib/cn'

interface ToolbarProps {
  children: React.ReactNode
  className?: string
}

export function Toolbar({ children, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b bg-background px-4 py-2',
        className
      )}
    >
      {children}
    </div>
  )
}
