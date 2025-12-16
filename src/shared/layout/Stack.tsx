import { cn } from '@/shared/lib/cn'

interface StackProps {
  children: React.ReactNode
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const gapMap = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

export function Stack({ children, gap = 'md', className }: StackProps) {
  return (
    <div className={cn('flex flex-col', gapMap[gap], className)}>
      {children}
    </div>
  )
}
