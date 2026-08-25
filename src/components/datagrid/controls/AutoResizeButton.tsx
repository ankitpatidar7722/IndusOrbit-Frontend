'use client'

import React from 'react'
import { Maximize2 } from 'lucide-react'
import { Button } from 'indas-ui'

interface AutoResizeButtonProps {
  onAutoResize: () => void
  disabled?: boolean
  className?: string
}

export function AutoResizeButton({
  onAutoResize,
  disabled = false,
  className = '',
}: AutoResizeButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onAutoResize}
      disabled={disabled}
      className={`w-9 h-8 p-0 ${className}`}
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </Button>
  )
}