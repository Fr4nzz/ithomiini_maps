import { ChevronRight, ExternalLink, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/collapsible'
import { Button } from '@/shared/ui/button'
import { useDataStore } from '@/features/data'
import { cn } from '@/shared/lib/utils'

interface GbifCitationSectionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GbifCitationSection({ open, onOpenChange }: GbifCitationSectionProps) {
  const gbifCitation = useDataStore((s) => s.gbifCitation)
  const [copied, setCopied] = useState(false)

  if (!gbifCitation) return null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(gbifCitation.citation_text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="border-t">
      <CollapsibleTrigger className="flex w-full items-center gap-2.5 p-3 text-sm font-medium hover:bg-muted/50 transition-colors">
        <ChevronRight
          className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-90')}
        />
        <span className="text-primary">GBIF</span>
        Citation
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <div className="rounded-lg bg-muted p-3 text-xs">
          <p className="mb-3 text-muted-foreground leading-relaxed">
            {gbifCitation.citation_text}
          </p>

          {/* Dataset breakdown */}
          {gbifCitation.dataset_breakdown && (
            <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
              {gbifCitation.dataset_breakdown.iNaturalist && (
                <span className="rounded bg-background px-2 py-1">
                  <span className="font-medium text-green-600">iNaturalist:</span>{' '}
                  {gbifCitation.dataset_breakdown.iNaturalist.toLocaleString()}
                </span>
              )}
              {gbifCitation.dataset_breakdown['Other GBIF'] && (
                <span className="rounded bg-background px-2 py-1">
                  <span className="font-medium text-gray-600">Other GBIF:</span>{' '}
                  {gbifCitation.dataset_breakdown['Other GBIF'].toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" asChild>
              <a href={gbifCitation.doi_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                View DOI
              </a>
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
