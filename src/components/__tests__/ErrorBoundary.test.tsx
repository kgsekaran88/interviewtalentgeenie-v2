import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Suppress console.error in tests for expected errors
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

const ThrowingComponent = () => {
  throw new Error('Test error');
};

const SafeComponent = () => <div>Safe content</div>;

describe('ErrorBoundary', () => {
  afterEach(() => {
    consoleSpy.mockClear();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <SafeComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders error UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('includes section tag context', () => {
    render(
      <ErrorBoundary section="admin">
        <ThrowingComponent />
      </ErrorBoundary>
    );
    // ErrorBoundary should still render the error card
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows Return to Home and Reload buttons', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Return to Home')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });
});
