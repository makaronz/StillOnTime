import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from '@/components/Auth/LoginForm';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'react-hot-toast';

// Mock dependencies
vi.mock('@/stores/authStore');
vi.mock('react-hot-toast');

const mockUseAuthStore = vi.mocked(useAuthStore);
const mockToast = vi.mocked(toast);

describe('LoginForm Component', () => {
  const mockLogin = vi.fn();
  const mockAuthStore = {
    login: mockLogin,
    isLoading: false,
    error: null,
    isAuthenticated: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue(mockAuthStore as any);
  });

  const renderLoginForm = () => {
    return render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );
  };

  describe('Initial Rendering', () => {
    it('should render login form with all required fields', () => {
      renderLoginForm();

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
      expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
      expect(screen.getByText("Don't have an account? Sign Up")).toBeInTheDocument();
    });

    it('should have proper input types', () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should have proper form labels and placeholders', () => {
      renderLoginForm();

      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Enter invalid email
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should validate required fields', async () => {
      renderLoginForm();

      const submitButton = screen.getByRole('button', { name: 'Sign In' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });
    });

    it('should validate password length', async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Enter valid email but short password
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      });
    });

    it('should clear validation errors when user starts typing', async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      // Trigger validation error
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });

      // Start typing
      fireEvent.change(emailInput, { target: { value: 'test' } });

      await waitFor(() => {
        expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call login function with correct credentials', async () => {
      mockLogin.mockResolvedValue({ success: true });

      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    it('should show loading state during submission', async () => {
      mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      mockUseAuthStore.mockReturnValue({
        ...mockAuthStore,
        isLoading: true
      } as any);

      renderLoginForm();

      const submitButton = screen.getByRole('button', { name: 'Sign In' });
      fireEvent.click(submitButton);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Signing In...')).toBeInTheDocument();
    });

    it('should show success message on successful login', async () => {
      mockLogin.mockResolvedValue({ success: true });

      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Login successful!');
      });
    });

    it('should show error message on failed login', async () => {
      const errorMessage = 'Invalid credentials';
      mockLogin.mockRejectedValue(new Error(errorMessage));

      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('should display store error message when available', () => {
      mockUseAuthStore.mockReturnValue({
        ...mockAuthStore,
        error: 'Network error occurred'
      } as any);

      renderLoginForm();

      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', () => {
      renderLoginForm();

      const passwordInput = screen.getByLabelText('Password');
      const toggleButton = screen.getByTestId('password-toggle');

      // Initially password should be hidden
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Click toggle button
      fireEvent.click(toggleButton);

      // Password should be visible
      expect(passwordInput).toHaveAttribute('type', 'text');

      // Click again to hide
      fireEvent.click(toggleButton);

      // Password should be hidden again
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should update toggle button icon', () => {
      renderLoginForm();

      const toggleButton = screen.getByTestId('password-toggle');

      // Initially should show eye icon
      expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument();

      // Click to show password
      fireEvent.click(toggleButton);

      // Should show eye-off icon
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    });
  });

  describe('Remember Me Functionality', () => {
    it('should have remember me checkbox', () => {
      renderLoginForm();

      const rememberMeCheckbox = screen.getByLabelText('Remember me');
      expect(rememberMeCheckbox).toBeInTheDocument();
      expect(rememberMeCheckbox).not.toBeChecked();
    });

    it('should toggle remember me state', () => {
      renderLoginForm();

      const rememberMeCheckbox = screen.getByLabelText('Remember me');
      fireEvent.click(rememberMeCheckbox);

      expect(rememberMeCheckbox).toBeChecked();

      fireEvent.click(rememberMeCheckbox);

      expect(rememberMeCheckbox).not.toBeChecked();
    });

    it('should include remember me in login request', async () => {
      mockLogin.mockResolvedValue({ success: true });

      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const rememberMeCheckbox = screen.getByLabelText('Remember me');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(rememberMeCheckbox);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          rememberMe: true
        });
      });
    });
  });

  describe('Navigation Links', () => {
    it('should navigate to forgot password page', () => {
      renderLoginForm();

      const forgotPasswordLink = screen.getByText('Forgot Password?');
      fireEvent.click(forgotPasswordLink);

      expect(window.location.pathname).toBe('/forgot-password');
    });

    it('should navigate to signup page', () => {
      renderLoginForm();

      const signupLink = screen.getByText("Don't have an account? Sign Up");
      fireEvent.click(signupLink);

      expect(window.location.pathname).toBe('/signup');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should submit form when pressing Enter in email field', async () => {
      mockLogin.mockResolvedValue({ success: true });

      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.keyDown(emailInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    it('should submit form when pressing Enter in password field', async () => {
      mockLogin.mockResolvedValue({ success: true });

      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.keyDown(passwordInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });

    it('should focus next field when pressing Tab', () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');

      emailInput.focus();
      fireEvent.keyDown(emailInput, { key: 'Tab' });

      const passwordInput = screen.getByLabelText('Password');
      expect(passwordInput).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderLoginForm();

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    it('should announce form validation errors', async () => {
      renderLoginForm();

      const submitButton = screen.getByRole('button', { name: 'Sign In' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Please fix the errors below')).toBeInTheDocument();
      });
    });

    it('should have proper form structure', () => {
      renderLoginForm();

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Login form');
    });

    it('should support screen readers', () => {
      renderLoginForm();

      const passwordToggle = screen.getByTestId('password-toggle');
      expect(passwordToggle).toHaveAttribute('aria-label', 'Toggle password visibility');
    });
  });

  describe('Auto-fill Support', () => {
    it('should support browser auto-fill attributes', () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');

      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    });
  });

  describe('Error Recovery', () => {
    it('should clear form fields after successful login', async () => {
      mockLogin.mockResolvedValue({ success: true });

      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toHaveValue('');
        expect(passwordInput).toHaveValue('');
      });
    });

    it('should retain form values after failed login', async () => {
      mockLogin.mockRejectedValue(new Error('Login failed'));

      renderLoginForm();

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: 'Sign In' });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(emailInput).toHaveValue('test@example.com');
        expect(passwordInput).toHaveValue('password123');
      });
    });
  });
});