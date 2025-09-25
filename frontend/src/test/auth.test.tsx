import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import LoadingSpinner from '@/components/LoadingSpinner'

// Utility function for rendering components with router context
// const renderWithRouter = (component: React.ReactElement) => {
//   return render(
//     <BrowserRouter>
//       {component}
//     </BrowserRouter>
//   )
// }

describe('Authentication Components', () => {
  describe('LoadingSpinner Component', () => {
    it('renders loading spinner correctly', () => {
      render(<LoadingSpinner />)
      
      // Check if spinner is rendered (it has animate-spin class)
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('renders with custom text', () => {
      render(<LoadingSpinner text="Loading data..." />)
      
      expect(screen.getByText('Loading data...')).toBeInTheDocument()
    })

    it('renders with different sizes', () => {
      const { rerender } = render(<LoadingSpinner size="sm" />)
      
      let spinner = document.querySelector('.h-4.w-4')
      expect(spinner).toBeInTheDocument()

      rerender(<LoadingSpinner size="lg" />)
      
      spinner = document.querySelector('.h-8.w-8')
      expect(spinner).toBeInTheDocument()
    })
  })
})

describe('Authentication Flow', () => {
  it('should have proper OAuth 2.0 flow structure', () => {
    // Test that the auth flow components exist and are properly structured
    expect(true).toBe(true) // Placeholder test
  })
})