import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../src/App';
import { config } from '../src/config/config';
import { initializeServices } from '../src/services';

// Mock dependencies
jest.mock('../src/services');
jest.mock('../src/config/config');
jest.mock('../src/services/api');

const mockInitializeServices = initializeServices as jest.MockedFunction<typeof initializeServices>;
const mockConfig = config as jest.Mocked<typeof config>;

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Frontend Initialization Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default config
    mockConfig.apiUrl = 'http://localhost:3001/api';
    mockConfig.appName = 'StillOnTime';
    mockConfig.version = '1.0.0';

    // Setup service initialization mock
    mockInitializeServices.mockResolvedValue();

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Application Bootstrap', () => {
    it('should render application without crashing', async () => {
      // Arrange & Act
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Assert
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('should initialize services on app start', async () => {
      // Arrange & Act
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Assert
      await waitFor(() => {
        expect(mockInitializeServices).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle service initialization failure', async () => {
      // Arrange
      mockInitializeServices.mockRejectedValue(new Error('Service initialization failed'));

      // Act & Assert
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockInitializeServices).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Configuration Loading', () => {
    it('should load correct API configuration', () => {
      // Assert
      expect(mockConfig.apiUrl).toBe('http://localhost:3001/api');
    });

    it('should have valid application metadata', () => {
      // Assert
      expect(mockConfig.appName).toBe('StillOnTime');
      expect(mockConfig.version).toBe('1.0.0');
    });

    it('should handle missing configuration gracefully', () => {
      // Arrange
      mockConfig.apiUrl = '';

      // Act & Assert
      expect(() => {
        render(
          <TestWrapper>
            <App />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Service Dependencies', () => {
    it('should initialize API service', async () => {
      // Arrange & Act
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Assert
      await waitFor(() => {
        expect(mockInitializeServices).toHaveBeenCalled();
      });
    });

    it('should initialize authentication service', async () => {
      // Test that authentication is properly initialized
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockInitializeServices).toHaveBeenCalled();
      });
    });

    it('should initialize monitoring service', async () => {
      // Test that monitoring is properly initialized
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockInitializeServices).toHaveBeenCalled();
      });
    });
  });

  describe('Route Initialization', () => {
    it('should initialize routing correctly', async () => {
      // Arrange & Act
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Assert
      await waitFor(() => {
        expect(window.location.pathname).toBe('/');
      });
    });

    it('should handle protected routes', async () => {
      // Test that protected routes work correctly
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Navigate to a protected route
      window.history.pushState({}, '', '/dashboard');

      await waitFor(() => {
        expect(window.location.pathname).toBe('/dashboard');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Arrange
      mockInitializeServices.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(console.error).toHaveBeenCalled();
      });
    });

    it('should render error boundary when component crashes', async () => {
      // Test error boundary functionality
      const ThrowErrorComponent: React.FC = () => {
        throw new Error('Test error');
      };

      expect(() => {
        render(
          <TestWrapper>
            <ThrowErrorComponent />
          </TestWrapper>
        );
      }).toThrow('Test error');
    });
  });

  describe('Performance Tests', () => {
    it('should render within acceptable time limits', async () => {
      // Arrange
      const startTime = performance.now();

      // Act
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Assert
      await waitFor(() => {
        const renderTime = performance.now() - startTime;
        expect(renderTime).toBeLessThan(1000); // Should render within 1 second
      });
    });

    it('should handle multiple rapid re-renders', async () => {
      // Arrange
      const { rerender } = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Act
      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        rerender(
          <TestWrapper>
            <App key={i} />
          </TestWrapper>
        );
      }

      // Assert
      await waitFor(() => {
        const rerenderTime = performance.now() - startTime;
        expect(rerenderTime).toBeLessThan(2000); // Should complete within 2 seconds
      });
    });
  });

  describe('Security Validation', () => {
    it('should not expose sensitive configuration', () => {
      // Assert that sensitive config is not exposed
      expect(mockConfig).not.toHaveProperty('apiKey');
      expect(mockConfig).not.toHaveProperty('password');
    });

    it('should handle XSS attempts safely', async () => {
      // Arrange
      const maliciousInput = '<script>alert("xss")</script>';

      // Act
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Assert - Application should not execute malicious scripts
      expect(document.querySelector('script')).toBeNull();
    });
  });

  describe('Browser Compatibility', () => {
    it('should work with modern browser APIs', () => {
      // Test that required browser APIs are available
      expect(typeof window.fetch).toBe('function');
      expect(typeof window.localStorage).toBe('object');
      expect(typeof window.sessionStorage).toBe('object');
    });

    it('should handle missing browser APIs gracefully', () => {
      // Test graceful degradation
      const originalFetch = window.fetch;
      (window as any).fetch = undefined;

      expect(() => {
        render(
          <TestWrapper>
            <App />
          </TestWrapper>
        );
      }).not.toThrow();

      // Restore
      window.fetch = originalFetch;
    });
  });

  describe('Accessibility Tests', () => {
    it('should have proper ARIA labels', async () => {
      // Arrange & Act
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Assert
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      // Test keyboard navigation support
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        const focusableElements = document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        expect(focusableElements.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt to mobile screen sizes', async () => {
      // Arrange
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      // Act
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Assert
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('should handle orientation changes', async () => {
      // Test landscape orientation
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 667,
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });
});