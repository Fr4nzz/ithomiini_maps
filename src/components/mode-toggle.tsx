import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/app/providers'
import { Button } from '@/shared/ui/button'

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getIcon = () => {
    if (theme === 'light') return <Sun className="h-4 w-4" />
    if (theme === 'dark') return <Moon className="h-4 w-4" />
    return <Monitor className="h-4 w-4" />
  }

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
      {getIcon()}
      <span className="capitalize">{theme}</span>
    </Button>
  )
}
