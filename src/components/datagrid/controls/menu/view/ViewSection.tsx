'use client'

import React from 'react'
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from 'indas-ui'
import { Grid3X3, LayoutGrid, BarChart3, Check, Eye } from 'lucide-react'
import { useLanguage } from 'indas-ui'

interface ViewSectionProps {
  currentView: 'grid' | 'chart' | 'cards'
  onViewChange: (view: 'grid' | 'chart' | 'cards') => void
}

export function ViewSection({ currentView, onViewChange }: ViewSectionProps) {
  const { t } = useLanguage()

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Eye className="mr-2 h-4 w-4" />
          <span>{t('View Options')}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem onClick={() => onViewChange('grid')}>
            <Grid3X3 className="mr-2 h-4 w-4" />
            <span>{t('Grid View')}</span>
            {currentView === 'grid' && <Check className="ml-auto h-4 w-4 text-[rgb(var(--color-primary))]" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewChange('cards')}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>{t('Card View')}</span>
            {currentView === 'cards' && <Check className="ml-auto h-4 w-4 text-[rgb(var(--color-primary))]" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewChange('chart')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>{t('Chart View')}</span>
            {currentView === 'chart' && <Check className="ml-auto h-4 w-4 text-[rgb(var(--color-primary))]" />}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}
