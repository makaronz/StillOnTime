import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '@/components/Dashboard';
import { useAuthStore } from '@/stores/authStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useNotificationStore } from '@/stores/notificationStore';

// Mock stores
vi.mock('@/stores/authStore');
vi.mock('@/stores/scheduleStore');
vi.mock('@/stores/notificationStore');

// Mock chart components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}));

const mockUseAuthStore = vi.mocked(useAuthStore);
const mockUseScheduleStore = vi.mocked(useScheduleStore);
const mockUseNotificationStore = vi.mocked(useNotificationStore);

describe('Dashboard Component', () => {
  const mockAuthStore = {
    user: {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'producer'
    },
    isAuthenticated: true,
    isLoading: false
  };

  const mockScheduleStore = {
    schedules: [
      {
        id: 'schedule-1',
        title: 'Film Shoot Day 1',
        shootingDate: new Date('2025-01-15'),
        callTime: '08:00',
        wrapTime: '18:00',
        location: 'Studio A',
        status: 'SCHEDULED'
      },
      {
        id: 'schedule-2',
        title: 'Film Shoot Day 2',
        shootingDate: new Date('2025-01-16'),
        callTime: '09:00',
        wrapTime: '17:00',
        location: 'Location B',
        status: 'IN_PROGRESS'
      }
    ],
    loading: false,
    error: null,
    fetchSchedules: vi.fn(),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn()
  };

  const mockNotificationStore = {
    notifications: [
      {
        id: 'notif-1',
        type: 'INFO',
        message: 'Schedule for tomorrow has been confirmed',
        read: false,
        createdAt: new Date()
      }
    ],
    unreadCount: 1,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue(mockAuthStore as any);
    mockUseScheduleStore.mockReturnValue(mockScheduleStore as any);
    mockUseNotificationStore.mockReturnValue(mockNotificationStore as any);
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  describe('Initial Rendering', () => {
    it('should render dashboard header with user name', () => {
      renderDashboard();

      expect(screen.getByText(/Welcome, John Doe/)).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should render dashboard statistics cards', () => {
      renderDashboard();

      expect(screen.getByText('Total Schedules')).toBeInTheDocument();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('should render schedule overview section', () => {
      renderDashboard();

      expect(screen.getByText('Upcoming Schedules')).toBeInTheDocument();
      expect(screen.getByText('Film Shoot Day 1')).toBeInTheDocument();
      expect(screen.getByText('Film Shoot Day 2')).toBeInTheDocument();
    });

    it('should render notifications panel', () => {
      renderDashboard();

      expect(screen.getByText('Recent Notifications')).toBeInTheDocument();
      expect(screen.getByText('Schedule for tomorrow has been confirmed')).toBeInTheDocument();
    });

    it('should render charts section', () => {
      renderDashboard();

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.getByText('Schedule Overview')).toBeInTheDocument();
      expect(screen.getByText('Production Timeline')).toBeInTheDocument();
    });
  });

  describe('Data Loading States', () => {
    it('should show loading spinner while schedules are loading', () => {
      mockUseScheduleStore.mockReturnValue({
        ...mockScheduleStore,
        loading: true
      } as any);

      renderDashboard();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should show error message when schedules fail to load', () => {
      mockUseScheduleStore.mockReturnValue({
        ...mockScheduleStore,
        error: 'Failed to load schedules'
      } as any);

      renderDashboard();

      expect(screen.getByText('Failed to load schedules')).toBeInTheDocument();
    });

    it('should show empty state when no schedules exist', () => {
      mockUseScheduleStore.mockReturnValue({
        ...mockScheduleStore,
        schedules: []
      } as any);

      renderDashboard();

      expect(screen.getByText('No schedules found')).toBeInTheDocument();
      expect(screen.getByText('Create your first schedule to get started')).toBeInTheDocument();
    });
  });

  describe('Schedule Interactions', () => {
    it('should navigate to schedule details when clicking on a schedule', async () => {
      renderDashboard();

      const scheduleCard = screen.getByText('Film Shoot Day 1');
      fireEvent.click(scheduleCard);

      await waitFor(() => {
        expect(window.location.pathname).toBe('/schedules/schedule-1');
      });
    });

    it('should open create schedule modal when clicking create button', () => {
      renderDashboard();

      const createButton = screen.getByText('Create Schedule');
      fireEvent.click(createButton);

      expect(screen.getByText('Create New Schedule')).toBeInTheDocument();
      expect(screen.getByLabelText('Schedule Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Shooting Date')).toBeInTheDocument();
    });

    it('should call createSchedule when form is submitted', async () => {
      const mockCreateSchedule = vi.fn().mockResolvedValue({});
      mockUseScheduleStore.mockReturnValue({
        ...mockScheduleStore,
        createSchedule: mockCreateSchedule
      } as any);

      renderDashboard();

      // Open create modal
      const createButton = screen.getByText('Create Schedule');
      fireEvent.click(createButton);

      // Fill form
      const titleInput = screen.getByLabelText('Schedule Title');
      const dateInput = screen.getByLabelText('Shooting Date');
      const locationInput = screen.getByLabelText('Location');

      fireEvent.change(titleInput, { target: { value: 'New Test Schedule' } });
      fireEvent.change(dateInput, { target: { value: '2025-01-20' } });
      fireEvent.change(locationInput, { target: { value: 'Studio C' } });

      // Submit form
      const submitButton = screen.getByText('Create Schedule');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreateSchedule).toHaveBeenCalledWith({
          title: 'New Test Schedule',
          shootingDate: expect.any(Date),
          location: 'Studio C'
        });
      });
    });
  });

  describe('Notification Interactions', () => {
    it('should mark notification as read when clicking on it', async () => {
      const mockMarkAsRead = vi.fn();
      mockUseNotificationStore.mockReturnValue({
        ...mockNotificationStore,
        markAsRead: mockMarkAsRead
      } as any);

      renderDashboard();

      const notification = screen.getByText('Schedule for tomorrow has been confirmed');
      fireEvent.click(notification);

      await waitFor(() => {
        expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1');
      });
    });

    it('should mark all notifications as read when clicking clear all', async () => {
      const mockMarkAllAsRead = vi.fn();
      mockUseNotificationStore.mockReturnValue({
        ...mockNotificationStore,
        markAllAsRead: mockMarkAllAsRead
      } as any);

      renderDashboard();

      const clearAllButton = screen.getByText('Mark All as Read');
      fireEvent.click(clearAllButton);

      await waitFor(() => {
        expect(mockMarkAllAsRead).toHaveBeenCalled();
      });
    });

    it('should show notification count badge', () => {
      renderDashboard();

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByTestId('notification-badge')).toHaveClass('bg-red-500');
    });
  });

  describe('Filtering and Search', () => {
    it('should filter schedules by date range', async () => {
      renderDashboard();

      const dateFilterButton = screen.getByText('Date Range');
      fireEvent.click(dateFilterButton);

      const startDateInput = screen.getByLabelText('Start Date');
      const endDateInput = screen.getByLabelText('End Date');

      fireEvent.change(startDateInput, { target: { value: '2025-01-01' } });
      fireEvent.change(endDateInput, { target: { value: '2025-01-31' } });

      const applyButton = screen.getByText('Apply Filter');
      fireEvent.click(applyButton);

      await waitFor(() => {
        expect(mockScheduleStore.fetchSchedules).toHaveBeenCalledWith({
          startDate: expect.any(Date),
          endDate: expect.any(Date)
        });
      });
    });

    it('should search schedules by keyword', async () => {
      renderDashboard();

      const searchInput = screen.getByPlaceholderText('Search schedules...');
      fireEvent.change(searchInput, { target: { value: 'Studio' } });

      await waitFor(() => {
        expect(mockScheduleStore.fetchSchedules).toHaveBeenCalledWith({
          search: 'Studio'
        });
      });
    });

    it('should filter schedules by status', async () => {
      renderDashboard();

      const statusFilter = screen.getByText('All Status');
      fireEvent.click(statusFilter);

      const scheduledOption = screen.getByText('Scheduled');
      fireEvent.click(scheduledOption);

      await waitFor(() => {
        expect(mockScheduleStore.fetchSchedules).toHaveBeenCalledWith({
          status: 'SCHEDULED'
        });
      });
    });
  });

  describe('Responsive Design', () => {
    it('should show mobile menu on small screens', () => {
      // Mock window.innerWidth to simulate mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });

      renderDashboard();

      expect(screen.getByTestId('mobile-menu-button')).toBeInTheDocument();
    });

    it('should collapse sidebar on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });

      renderDashboard();

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass('-translate-x-full');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockUseScheduleStore.mockReturnValue({
        ...mockScheduleStore,
        fetchSchedules: vi.fn().mockRejectedValue(new Error('Network error'))
      } as any);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Unable to load schedules. Please try again.')).toBeInTheDocument();
      });
    });

    it('should handle create schedule errors', async () => {
      const mockCreateSchedule = vi.fn().mockRejectedValue(new Error('Validation failed'));
      mockUseScheduleStore.mockReturnValue({
        ...mockScheduleStore,
        createSchedule: mockCreateSchedule
      } as any);

      renderDashboard();

      // Open create modal
      const createButton = screen.getByText('Create Schedule');
      fireEvent.click(createButton);

      // Submit form
      const submitButton = screen.getByText('Create Schedule');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Validation failed')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderDashboard();

      expect(screen.getByLabelText('Dashboard navigation')).toBeInTheDocument();
      expect(screen.getByLabelText('Schedule overview')).toBeInTheDocument();
      expect(screen.getByLabelText('User notifications')).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      renderDashboard();

      const firstSchedule = screen.getByText('Film Shoot Day 1');
      firstSchedule.focus();

      fireEvent.keyDown(firstSchedule, { key: 'Enter' });

      // Should trigger navigation
      expect(window.location.pathname).toBe('/schedules/schedule-1');
    });

    it('should announce loading states to screen readers', () => {
      mockUseScheduleStore.mockReturnValue({
        ...mockScheduleStore,
        loading: true
      } as any);

      renderDashboard();

      expect(screen.getByLabelText('Loading schedules')).toBeInTheDocument();
    });
  });

  describe('Performance Optimization', () => {
    it('should debounce search input', async () => {
      const { rerender } = renderDashboard();

      const searchInput = screen.getByPlaceholderText('Search schedules...');

      // Type multiple characters quickly
      fireEvent.change(searchInput, { target: { value: 'St' } });
      fireEvent.change(searchInput, { target: { value: 'Stu' } });
      fireEvent.change(searchInput, { target: { value: 'Stud' } });
      fireEvent.change(searchInput, { target: { value: 'Studio' } });

      // Should only call fetchSchedules once after debounce
      await waitFor(() => {
        expect(mockScheduleStore.fetchSchedules).toHaveBeenCalledTimes(1);
        expect(mockScheduleStore.fetchSchedules).toHaveBeenCalledWith({
          search: 'Studio'
        });
      }, { timeout: 1000 });
    });

    it('should lazy load charts', async () => {
      renderDashboard();

      // Charts should not be in DOM initially
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();

      // Scroll to charts section
      fireEvent.scroll(window, { target: { scrollY: 500 } });

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });
  });
});