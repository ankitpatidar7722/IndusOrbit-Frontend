'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'

interface InlineSearchCellProps {
  value: any
  columnId: string
  rowId: string
  onSearch: (columnId: string, searchTerm: string) => void
  onClearSearch: (columnId: string) => void
  isSearchActive: boolean
  searchTerm: string
  className?: string
}

export function InlineSearchCell({
  value,
  columnId,
  rowId,
  onSearch,
  onClearSearch,
  isSearchActive,
  searchTerm,
  className = ''
}: InlineSearchCellProps) {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm)
  const [isTyping, setIsTyping] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null)
  const cellRef = useRef<HTMLDivElement>(null)

  // Update local search term when prop changes
  useEffect(() => {
    setLocalSearchTerm(searchTerm)
  }, [searchTerm])

  // Reset typing timer function
  const resetTypingTimer = () => {
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }

    // Set new timeout to stop typing indicator
    const timeout = setTimeout(() => {
      setIsTyping(false)
    }, 1500)
    setTypingTimeout(timeout)
  }

  // Handle direct typing on the cell
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if this cell is focused or clicked
      if (!cellRef.current || !cellRef.current.contains(document.activeElement)) return

      // Handle backspace to clear search
      if (event.key === 'Backspace') {
        event.preventDefault()
        if (localSearchTerm.length > 0) {
          const newTerm = localSearchTerm.slice(0, -1)
          setLocalSearchTerm(newTerm)
          onSearch(columnId, newTerm)
        } else {
          onClearSearch(columnId)
        }
        setIsTyping(true)
        resetTypingTimer()
        return
      }

      // Handle escape to clear search
      if (event.key === 'Escape') {
        event.preventDefault()
        setLocalSearchTerm('')
        onClearSearch(columnId)
        setIsTyping(false)
        cellRef.current?.blur()
        return
      }

      // Handle printable characters
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()

        const newTerm = localSearchTerm + event.key
        setLocalSearchTerm(newTerm)
        onSearch(columnId, newTerm)
        setIsTyping(true)
        resetTypingTimer()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (typingTimeout) {
        clearTimeout(typingTimeout)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearchTerm, columnId, onSearch, onClearSearch])

  const handleCellClick = () => {
    // Make cell focusable for keyboard input
    if (cellRef.current) {
      cellRef.current.focus()
    }
  }

  // Highlight matching text in the display value
  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight || !text) return text

    const parts = text.toString().split(new RegExp(`(${highlight})`, 'gi'))
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    )
  }

  const displayValue = value?.toString() || ''

  return (
    <div
      ref={cellRef}
      tabIndex={0} // Make focusable
      className={`bacchasearch relative group cursor-pointer outline-none inline-flex items-center w-full ${className}`}
      onClick={handleCellClick}
    >
      <span
        className={`
          text-xs flex-1 rounded transition-colors
          ${isSearchActive ? 'bg-[rgb(var(--color-primary)/0.1)]' : 'hover:bg-[rgb(var(--color-primary)/0.05)]'}
          ${isTyping ? 'ring-1 ring-[rgb(var(--color-primary)/0.3)] bg-[rgb(var(--color-primary)/0.15)]' : ''}
        `}
      >
        {isSearchActive && searchTerm ?
          renderHighlightedText(displayValue, searchTerm) :
          displayValue
        }
      </span>

      {/* Search icon hint on hover */}
      <Search className={`h-3 w-3 text-[rgb(var(--fg-muted))] ml-0.5 flex-shrink-0 transition-opacity ${isTyping ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

      {/* Typing/Search indicator dot */}
      {(isTyping || isSearchActive) && (
        <div className="absolute -top-0.5 -right-0.5">
          <div className={`h-1.5 w-1.5 rounded-full ${isTyping ? 'bg-[rgb(var(--color-success))]' : 'bg-[rgb(var(--color-primary))]'}`}></div>
        </div>
      )}

      {/* Search term display when typing */}
      {isTyping && localSearchTerm && (
        <div className="absolute -bottom-5 left-0 bg-[rgb(var(--bg-surface))] text-[rgb(var(--fg-default))] text-xs px-1.5 py-0.5 rounded shadow-lg border border-[rgb(var(--bd-default))] z-10 whitespace-nowrap">
          &quot;{localSearchTerm}&quot;
        </div>
      )}
    </div>
  )
}