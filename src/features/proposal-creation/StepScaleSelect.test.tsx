/**
 * StepScaleSelect Component Tests
 *
 * Tests for the scale selection step of the proposal wizard.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { StepScaleSelect } from './components/StepScaleSelect';

describe('StepScaleSelect', () => {
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all scale options', () => {
    render(<StepScaleSelect onNext={mockOnNext} onBack={mockOnBack} />);

    expect(screen.getByText('Small')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('should show funding ranges for each scale', () => {
    render(<StepScaleSelect onNext={mockOnNext} onBack={mockOnBack} />);

    expect(screen.getByText(/Up to 1,000 DOM/)).toBeInTheDocument();
    expect(screen.getByText(/1,000 - 10,000 DOM/)).toBeInTheDocument();
    expect(screen.getByText(/Over 10,000 DOM/)).toBeInTheDocument();
  });

  it('should default to medium scale', () => {
    render(<StepScaleSelect onNext={mockOnNext} onBack={mockOnBack} />);

    const mediumRadio = screen.getByRole('radio', { name: /Medium/i });
    expect(mediumRadio).toBeChecked();
  });

  it('should use initial value when provided', () => {
    render(<StepScaleSelect initialValue="large" onNext={mockOnNext} onBack={mockOnBack} />);

    const largeRadio = screen.getByRole('radio', { name: /Large/i });
    expect(largeRadio).toBeChecked();
  });

  it('should call onNext with selected scale on submit', async () => {
    const user = userEvent.setup();
    render(<StepScaleSelect onNext={mockOnNext} onBack={mockOnBack} />);

    // Select small scale
    const smallRadio = screen.getByRole('radio', { name: /Small/i });
    await user.click(smallRadio);

    // Submit
    const submitButton = screen.getByRole('button', { name: /Continue/i });
    await user.click(submitButton);

    expect(mockOnNext).toHaveBeenCalledWith('small');
  });

  it('should call onBack when Back button is clicked', async () => {
    const user = userEvent.setup();
    render(<StepScaleSelect onNext={mockOnNext} onBack={mockOnBack} />);

    const backButton = screen.getByRole('button', { name: /Back/i });
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it('should show quorum requirements', () => {
    render(<StepScaleSelect onNext={mockOnNext} onBack={mockOnBack} />);

    expect(screen.getByText(/10% quorum required/)).toBeInTheDocument();
    expect(screen.getByText(/20% quorum required/)).toBeInTheDocument();
    expect(screen.getByText(/30% quorum required/)).toBeInTheDocument();
  });
});
