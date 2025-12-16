import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { fuzzySearch } from '@/shared/lib/fuzzySearch'
import { Button } from '@/shared/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/ui/popover'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Input } from '@/shared/ui/input'

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  emptyText?: string
  className?: string
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  emptyText = 'No results found.',
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  // Filter options with fuzzy search
  const filteredOptions = React.useMemo(() => {
    return fuzzySearch(search, options, 100)
  }, [search, options])

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue === value ? '' : selectedValue)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="h-[200px]">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                    value === option && 'bg-accent'
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{option}</span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
