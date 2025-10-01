/**
 * Advanced Utility Functions for Dynamic CSS Class Management
 * Provides intelligent class name concatenation and conditional styling
 */

/**
 * Concatenate class names with intelligent filtering
 * Handles conditional classes, null/undefined values, and duplicates
 */
export function cn(...classes: (string | undefined | false | null | Record<string, boolean>)[]): string {
  const classArray: string[] = []
  
  classes.forEach(cls => {
    if (!cls) return
    
    if (typeof cls === 'string') {
      classArray.push(cls)
    } else if (typeof cls === 'object') {
      Object.entries(cls).forEach(([key, value]) => {
        if (value) {
          classArray.push(key)
        }
      })
    }
  })
  
  // Remove duplicates while preserving order
  const uniqueClasses = [...new Set(classArray)]
  
  return uniqueClasses.join(' ')
}

/**
 * Conditional class application with type safety
 */
export function conditional(
  condition: boolean | (() => boolean),
  trueClasses: string,
  falseClasses: string = ''
): string {
  const isTrue = typeof condition === 'function' ? condition() : condition
  return isTrue ? trueClasses : falseClasses
}

/**
 * Variant-based class selection
 */
export function variant<T extends string>(
  selected: T,
  variants: Record<T, string>,
  defaultVariant?: string
): string {
  return variants[selected] || defaultVariant || ''
}

/**
 * Size-based class generation
 */
export function size(
  sizeValue: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number,
  prefix: string = 'text'
): string {
  if (typeof sizeValue === 'number') {
    return `${prefix}-[${sizeValue}px]`
  }
  return `${prefix}-${sizeValue}`
}

/**
 * Responsive class generation
 */
export function responsive(classes: {
  base?: string
  sm?: string
  md?: string
  lg?: string
  xl?: string
  '2xl'?: string
}): string {
  const responsiveClasses: string[] = []
  
  if (classes.base) responsiveClasses.push(classes.base)
  if (classes.sm) responsiveClasses.push(`sm:${classes.sm}`)
  if (classes.md) responsiveClasses.push(`md:${classes.md}`)
  if (classes.lg) responsiveClasses.push(`lg:${classes.lg}`)
  if (classes.xl) responsiveClasses.push(`xl:${classes.xl}`)
  if (classes['2xl']) responsiveClasses.push(`2xl:${classes['2xl']}`)
  
  return responsiveClasses.join(' ')
}

/**
 * State-based class application
 */
export function states(classes: {
  base: string
  hover?: string
  focus?: string
  active?: string
  disabled?: string
  loading?: string
}): string {
  const stateClasses = [classes.base]
  
  if (classes.hover) stateClasses.push(`hover:${classes.hover}`)
  if (classes.focus) stateClasses.push(`focus:${classes.focus}`)
  if (classes.active) stateClasses.push(`active:${classes.active}`)
  if (classes.disabled) stateClasses.push(`disabled:${classes.disabled}`)
  if (classes.loading) stateClasses.push(`data-loading:${classes.loading}`)
  
  return stateClasses.join(' ')
}

/**
 * Animation class helpers
 */
export function animation(
  type: 'fade' | 'slide' | 'scale' | 'spin' | 'pulse' | 'bounce',
  duration: 'fast' | 'normal' | 'slow' = 'normal',
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'ease-in-out'
): string {
  const durationMap = {
    fast: 'duration-150',
    normal: 'duration-300',
    slow: 'duration-500'
  }
  
  const easingMap = {
    linear: 'ease-linear',
    ease: 'ease',
    'ease-in': 'ease-in',
    'ease-out': 'ease-out',
    'ease-in-out': 'ease-in-out'
  }
  
  const animationMap = {
    fade: 'transition-opacity',
    slide: 'transition-transform',
    scale: 'transition-transform',
    spin: 'animate-spin',
    pulse: 'animate-pulse',
    bounce: 'animate-bounce'
  }
  
  return cn(
    animationMap[type],
    durationMap[duration],
    easingMap[easing]
  )
}

/**
 * Theme-aware class generation
 */
export function theme(
  lightClasses: string,
  darkClasses: string,
  systemClasses?: string
): string {
  const classes = [lightClasses, `dark:${darkClasses}`]
  
  if (systemClasses) {
    classes.push(`system:${systemClasses}`)
  }
  
  return classes.join(' ')
}

/**
 * Focus management classes for accessibility
 */
export function focus(
  type: 'ring' | 'outline' | 'underline' | 'background' = 'ring',
  color: string = 'primary-500',
  size: 'sm' | 'md' | 'lg' = 'md'
): string {
  switch (type) {
    case 'ring':
      return `focus:outline-none focus:ring-2 focus:ring-${color} focus:ring-offset-2`
    case 'outline':
      return `focus:outline-2 focus:outline-${color} focus:outline-offset-2`
    case 'underline':
      return `focus:outline-none focus:border-b-2 focus:border-${color}`
    case 'background':
      return `focus:outline-none focus:bg-${color}/10`
    default:
      return ''
  }
}

/**
 * Elevation/shadow classes
 */
export function elevation(
  level: 0 | 1 | 2 | 3 | 4 | 5,
  hover?: boolean
): string {
  const shadowMap = {
    0: 'shadow-none',
    1: 'shadow-sm',
    2: 'shadow',
    3: 'shadow-md',
    4: 'shadow-lg',
    5: 'shadow-xl'
  }
  
  const hoverShadowMap = {
    0: 'hover:shadow-sm',
    1: 'hover:shadow',
    2: 'hover:shadow-md',
    3: 'hover:shadow-lg',
    4: 'hover:shadow-xl',
    5: 'hover:shadow-2xl'
  }
  
  return cn(
    shadowMap[level],
    hover && hoverShadowMap[level]
  )
}

/**
 * Spacing utility with responsive support
 */
export function spacing(
  property: 'p' | 'm' | 'px' | 'py' | 'pl' | 'pr' | 'pt' | 'pb' | 'mx' | 'my' | 'ml' | 'mr' | 'mt' | 'mb',
  value: number | string,
  responsive?: {
    sm?: number | string
    md?: number | string
    lg?: number | string
    xl?: number | string
  }
): string {
  const baseClass = typeof value === 'number' ? `${property}-${value}` : `${property}-[${value}]`
  
  if (!responsive) return baseClass
  
  const responsiveClasses = [baseClass]
  
  Object.entries(responsive).forEach(([breakpoint, breakpointValue]) => {
    const breakpointClass = typeof breakpointValue === 'number' 
      ? `${breakpoint}:${property}-${breakpointValue}`
      : `${breakpoint}:${property}-[${breakpointValue}]`
    responsiveClasses.push(breakpointClass)
  })
  
  return responsiveClasses.join(' ')
}

/**
 * Color utility with opacity support
 */
export function color(
  property: 'bg' | 'text' | 'border' | 'ring',
  colorName: string,
  shade?: number | string,
  opacity?: number
): string {
  let colorClass = `${property}-${colorName}`
  
  if (shade) {
    colorClass += `-${shade}`
  }
  
  if (opacity) {
    colorClass += `/${opacity}`
  }
  
  return colorClass
}

/**
 * Layout utility for grid and flexbox
 */
export function layout(
  type: 'flex' | 'grid',
  options: {
    direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse'
    justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'
    align?: 'start' | 'end' | 'center' | 'stretch' | 'baseline'
    wrap?: boolean
    gap?: number | string
    cols?: number
    rows?: number
  } = {}
): string {
  const classes = [type]
  
  if (type === 'flex') {
    if (options.direction) classes.push(`flex-${options.direction}`)
    if (options.justify) classes.push(`justify-${options.justify}`)
    if (options.align) classes.push(`items-${options.align}`)
    if (options.wrap) classes.push('flex-wrap')
  }
  
  if (type === 'grid') {
    if (options.cols) classes.push(`grid-cols-${options.cols}`)
    if (options.rows) classes.push(`grid-rows-${options.rows}`)
    if (options.justify) classes.push(`justify-items-${options.justify}`)
    if (options.align) classes.push(`items-${options.align}`)
  }
  
  if (options.gap) {
    const gapClass = typeof options.gap === 'number' 
      ? `gap-${options.gap}` 
      : `gap-[${options.gap}]`
    classes.push(gapClass)
  }
  
  return classes.join(' ')
}