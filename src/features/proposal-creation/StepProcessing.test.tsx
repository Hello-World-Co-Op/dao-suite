/**
 * StepProcessing Component Tests
 *
 * Tests for the AI processing step of the proposal wizard.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 4, 5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { StepProcessing } from './components/StepProcessing';
import type { ThinkTankError } from '@/services/thinkTank';

describe('StepProcessing', () => {
  const mockOnRetry = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show queued status message', () => {
    render(
      <StepProcessing
        status="queued"
        estimatedTime={null}
        error={null}
        onRetry={mockOnRetry}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText(/queued/i)).toBeInTheDocument();
  });

  it('should show processing status with estimated time', () => {
    render(
      <StepProcessing
        status="processing"
        estimatedTime={15000}
        error={null}
        onRetry={mockOnRetry}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText(/analyzing your idea/i)).toBeInTheDocument();
    expect(screen.getByText(/15 seconds/i)).toBeInTheDocument();
  });

  it('should show completed status', () => {
    render(
      <StepProcessing
        status="completed"
        estimatedTime={null}
        error={null}
        onRetry={mockOnRetry}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText(/generated successfully/i)).toBeInTheDocument();
  });

  it('should show error message on failure', () => {
    const error: ThinkTankError = {
      code: 'TIMEOUT',
      message: 'Request timed out',
    };

    render(
      <StepProcessing
        status="failed"
        estimatedTime={null}
        error={error}
        onRetry={mockOnRetry}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText(/Generation failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('should show retry button for retryable errors', () => {
    const error: ThinkTankError = {
      code: 'AI_UNAVAILABLE',
      message: 'AI service temporarily unavailable',
    };

    render(
      <StepProcessing
        status="failed"
        estimatedTime={null}
        error={error}
        onRetry={mockOnRetry}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('should not show retry button for non-retryable errors', () => {
    const error: ThinkTankError = {
      code: 'INVALID_INPUT',
      message: 'Invalid input',
    };

    render(
      <StepProcessing
        status="failed"
        estimatedTime={null}
        error={error}
        onRetry={mockOnRetry}
        onBack={mockOnBack}
      />
    );

    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const error: ThinkTankError = {
      code: 'TIMEOUT',
      message: 'Request timed out',
    };

    render(
      <StepProcessing
        status="failed"
        estimatedTime={null}
        error={error}
        onRetry={mockOnRetry}
        onBack={mockOnBack}
      />
    );

    const retryButton = screen.getByRole('button', { name: /Retry/i });
    await user.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalled();
  });

  it('should call onBack when back/cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <StepProcessing
        status="processing"
        estimatedTime={null}
        error={null}
        onRetry={mockOnRetry}
        onBack={mockOnBack}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnBack).toHaveBeenCalled();
  });
});
