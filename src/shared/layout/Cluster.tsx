import { cn } from '@/shared/lib/cn'

interface ClusterProps {
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

export function Cluster({ children, gap = 'sm', className }: ClusterProps) {
  return (
    <div className={cn('flex flex-wrap items-center', gapMap[gap], className)}>
      {children}
    </div>
  )
}
