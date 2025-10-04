/**
 * Advanced Responsive Grid System
 * Intelligent layout management with adaptive breakpoints
 */

import React, { ReactNode, useMemo, memo, useCallback, useState, useRef } from 'react'
import { cn } from '@/utils/className'

export interface GridBreakpoint {
  cols: number
  gap: number
  minWidth: number
}

export interface ResponsiveGridProps {
  children: ReactNode
  className?: string
  
  // Responsive configuration
  breakpoints?: {
    mobile: GridBreakpoint
    tablet: GridBreakpoint
    desktop: GridBreakpoint
    wide: GridBreakpoint
  }
  
  // Layout options
  autoFit?: boolean
  minItemWidth?: number
  maxItemWidth?: number
  
  // Spacing and alignment
  gap?: number | string
  padding?: number | string
  justifyItems?: 'start' | 'end' | 'center' | 'stretch'
  alignItems?: 'start' | 'end' | 'center' | 'stretch'
  
  // Advanced features
  masonry?: boolean
  animateLayout?: boolean
  
  // Accessibility
  role?: string
  ariaLabel?: string
  ariaDescription?: string
}

/**
 * Responsive Grid Component with intelligent layout management
 * Optimized with React.memo for performance
 */
const ResponsiveGrid = memo(function ResponsiveGrid({
  children,
  className,
  breakpoints = {
    mobile: { cols: 1, gap: 4, minWidth: 320 },
    tablet: { cols: 2, gap: 6, minWidth: 768 },
    desktop: { cols: 3, gap: 8, minWidth: 1024 },
    wide: { cols: 4, gap: 10, minWidth: 1440 }
  },
  autoFit = false,
  minItemWidth = 280,
  maxItemWidth,
  gap,
  padding,
  justifyItems = 'stretch',
  alignItems = 'stretch',
  masonry = false,
  animateLayout = true,
  role = 'grid',
  ariaLabel,
  ariaDescription
}: ResponsiveGridProps): JSX.Element {
  
  // Generate responsive CSS classes with optimized memoization
  const gridClasses = useMemo(() => {
    const classes = ['grid', 'w-full']
    
    if (autoFit && minItemWidth) {
      classes.push(`grid-cols-[repeat(auto-fit,minmax(${minItemWidth}px,1fr))]`)
    } else {
      // Apply responsive column classes
      classes.push(`grid-cols-${breakpoints.mobile.cols}`)
      classes.push(`md:grid-cols-${breakpoints.tablet.cols}`)
      classes.push(`lg:grid-cols-${breakpoints.desktop.cols}`)
      classes.push(`xl:grid-cols-${breakpoints.wide.cols}`)
    }
    
    // Apply gap classes
    if (gap) {
      if (typeof gap === 'number') {
        classes.push(`gap-${gap}`)
      } else {
        classes.push(`gap-[${gap}]`)
      }
    } else {
      classes.push(`gap-${breakpoints.mobile.gap}`)
      classes.push(`md:gap-${breakpoints.tablet.gap}`)
      classes.push(`lg:gap-${breakpoints.desktop.gap}`)
      classes.push(`xl:gap-${breakpoints.wide.gap}`)
    }
    
    // Apply alignment
    if (justifyItems !== 'stretch') {
      classes.push(`justify-items-${justifyItems}`)
    }
    
    if (alignItems !== 'stretch') {
      classes.push(`items-${alignItems}`)
    }
    
    // Apply padding
    if (padding) {
      if (typeof padding === 'number') {
        classes.push(`p-${padding}`)
      } else {
        classes.push(`p-[${padding}]`)
      }
    }
    
    // Animation classes
    if (animateLayout) {
      classes.push('transition-all', 'duration-300', 'ease-in-out')
    }
    
    // Masonry layout support
    if (masonry) {
      classes.push('grid-flow-row-dense')
    }
    
    return classes
  }, [
    autoFit,
    minItemWidth,
    breakpoints,
    gap,
    justifyItems,
    alignItems,
    padding,
    animateLayout,
    masonry
  ])

  // Generate inline styles for complex layouts
  const gridStyles = useMemo(() => {
    const styles: React.CSSProperties = {}
    
    if (autoFit && minItemWidth) {
      styles.gridTemplateColumns = `repeat(auto-fit, minmax(${minItemWidth}px, ${maxItemWidth ? `${maxItemWidth}px` : '1fr'}))`
    }
    
    if (masonry) {
      styles.gridAutoRows = 'masonry'
    }
    
    return styles
  }, [autoFit, minItemWidth, maxItemWidth, masonry])

  return (
    <div
      className={cn(...gridClasses, className)}
      style={gridStyles}
      role={role}
      aria-label={ariaLabel}
      aria-description={ariaDescription}
    >
      {children}
    </div>
  )
})

export default ResponsiveGrid

/**
 * Grid Item Component with responsive span control
 */
interface GridItemProps {
  children: ReactNode
  className?: string
  
  // Responsive span configuration
  span?: {
    mobile?: number
    tablet?: number
    desktop?: number
    wide?: number
  }
  
  // Row span for masonry layouts
  rowSpan?: number
  
  // Item-specific alignment
  justifySelf?: 'start' | 'end' | 'center' | 'stretch'
  alignSelf?: 'start' | 'end' | 'center' | 'stretch'
  
  // Accessibility
  role?: string
  ariaLabel?: string
}

export const GridItem = memo(function GridItem({
  children,
  className,
  span,
  rowSpan,
  justifySelf,
  alignSelf,
  role = 'gridcell',
  ariaLabel
}: GridItemProps): JSX.Element {
  
  const itemClasses = useMemo(() => {
    const classes = []
    
    // Apply responsive column spans
    if (span) {
      if (span.mobile) classes.push(`col-span-${span.mobile}`)
      if (span.tablet) classes.push(`md:col-span-${span.tablet}`)
      if (span.desktop) classes.push(`lg:col-span-${span.desktop}`)
      if (span.wide) classes.push(`xl:col-span-${span.wide}`)
    }
    
    // Apply row span
    if (rowSpan) {
      classes.push(`row-span-${rowSpan}`)
    }
    
    // Apply self alignment
    if (justifySelf) {
      classes.push(`justify-self-${justifySelf}`)
    }
    
    if (alignSelf) {
      classes.push(`self-${alignSelf}`)
    }
    
    return classes
  }, [span, rowSpan, justifySelf, alignSelf])

  return (
    <div
      className={cn(...itemClasses, className)}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  )
})

/**
 * Responsive Card Grid - Specialized grid for card layouts
 */
interface CardGridProps extends Omit<ResponsiveGridProps, 'autoFit' | 'minItemWidth'> {
  cardMinWidth?: number
  cardMaxWidth?: number
  cardAspectRatio?: 'square' | 'video' | 'photo' | 'auto'
}

export const CardGrid = memo(function CardGrid({
  children,
  cardMinWidth = 320,
  cardMaxWidth = 400,
  cardAspectRatio = 'auto',
  className,
  ...gridProps
}: CardGridProps): JSX.Element {
  
  const aspectRatioClass = useMemo(() => {
    switch (cardAspectRatio) {
      case 'square': return 'aspect-square'
      case 'video': return 'aspect-video'
      case 'photo': return 'aspect-[4/3]'
      default: return ''
    }
  }, [cardAspectRatio])

  return (
    <ResponsiveGrid
      {...gridProps}
      autoFit={true}
      minItemWidth={cardMinWidth}
      maxItemWidth={cardMaxWidth}
      className={cn('card-grid', className)}
      ariaLabel={gridProps.ariaLabel || 'Card grid layout'}
    >
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          className={cn(
            'card-grid-item',
            aspectRatioClass,
            'transition-transform duration-200 hover:scale-105'
          )}
          role="gridcell"
          aria-label={`Card ${index + 1}`}
        >
          {child}
        </div>
      ))}
    </ResponsiveGrid>
  )
})

/**
 * Dashboard Grid - Specialized grid for dashboard widgets
 */
interface DashboardGridProps extends ResponsiveGridProps {
  compactMode?: boolean
  widgetGap?: number
}

export const DashboardGrid = memo(function DashboardGrid({
  children,
  compactMode = false,
  widgetGap = 6,
  className,
  ...gridProps
}: DashboardGridProps): JSX.Element {
  
  const dashboardBreakpoints = useMemo(() => ({
    mobile: { cols: 1, gap: compactMode ? 3 : 4, minWidth: 320 },
    tablet: { cols: compactMode ? 3 : 2, gap: compactMode ? 4 : 6, minWidth: 768 },
    desktop: { cols: compactMode ? 4 : 3, gap: compactMode ? 5 : 8, minWidth: 1024 },
    wide: { cols: compactMode ? 6 : 4, gap: compactMode ? 6 : 10, minWidth: 1440 }
  }), [compactMode])

  return (
    <ResponsiveGrid
      {...gridProps}
      breakpoints={dashboardBreakpoints}
      gap={widgetGap}
      className={cn('dashboard-grid', compactMode && 'compact-mode', className)}
      role="main"
      ariaLabel="Dashboard widgets grid"
    >
      {children}
    </ResponsiveGrid>
  )
})

/**
 * Virtualized Grid Component for large datasets
 * Renders only visible items for optimal performance
 */
interface VirtualizedGridProps extends Omit<ResponsiveGridProps, 'children'> {
  items: ReactNode[]
  itemHeight: number
  containerHeight: number
  overscan?: number
}

export const VirtualizedGrid = memo(function VirtualizedGrid({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
  ...gridProps
}: VirtualizedGridProps): JSX.Element {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    return items.slice(startIndex, endIndex + 1).map((item, index) => (
      <div
        key={startIndex + index}
        style={{
          position: 'absolute',
          top: (startIndex + index) * itemHeight,
          width: '100%',
          height: itemHeight,
        }}
      >
        {item}
      </div>
    ))
  }, [items, scrollTop, itemHeight, containerHeight, overscan])
  
  const totalHeight = items.length * itemHeight
  
  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
      className="relative"
    >
      <ResponsiveGrid {...gridProps} className={cn('relative', gridProps.className)}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleItems}
        </div>
      </ResponsiveGrid>
    </div>
  )
})

// Note: cn utility function is imported from @/utils/className