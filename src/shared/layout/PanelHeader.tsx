interface PanelHeaderProps {
  title: string
  actions?: React.ReactNode
}

export function PanelHeader({ title, actions }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {actions}
    </div>
  )
}
