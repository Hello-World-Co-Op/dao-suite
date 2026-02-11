/**
 * Step 2: Scale Selection
 *
 * Radio button selection for project scale (small/medium/large).
 * Each option shows funding range and governance requirements.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 3
 */

import React, { useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import type { ProposalScale } from '@/stores';

interface ScaleOption {
  value: ProposalScale;
  label: string;
  fundingRange: string;
  description: string;
  quorum: string;
}

const SCALE_OPTIONS: ScaleOption[] = [
  {
    value: 'small',
    label: 'Small',
    fundingRange: 'Up to 1,000 DOM',
    description: 'Quick initiatives, minor improvements, or small community events',
    quorum: '10% quorum required',
  },
  {
    value: 'medium',
    label: 'Medium',
    fundingRange: '1,000 - 10,000 DOM',
    description: 'Significant projects, ongoing programs, or infrastructure improvements',
    quorum: '20% quorum required',
  },
  {
    value: 'large',
    label: 'Large',
    fundingRange: 'Over 10,000 DOM',
    description: 'Major initiatives, long-term commitments, or substantial resource allocation',
    quorum: '30% quorum required',
  },
];

interface StepScaleSelectProps {
  initialValue?: ProposalScale;
  onNext: (scale: ProposalScale) => void;
  onBack: () => void;
  /** Called when the scale value changes (for auto-save) */
  onChange?: (scale: ProposalScale) => void;
}

export function StepScaleSelect({
  initialValue = 'medium',
  onNext,
  onBack,
  onChange,
}: StepScaleSelectProps) {
  const [selected, setSelected] = React.useState<ProposalScale>(initialValue);

  // Sync with initialValue when it changes (e.g., when resuming a draft)
  useEffect(() => {
    if (initialValue) {
      setSelected(initialValue);
    }
  }, [initialValue]);

  // Handle selection change
  const handleSelect = (scale: ProposalScale) => {
    setSelected(scale);
    // Notify parent for auto-save
    if (onChange && scale !== initialValue) {
      onChange(scale);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(selected);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Select Project Scale</h2>
        <p className="mt-2 text-gray-600">
          Choose the appropriate scale based on your funding needs and project scope.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          {SCALE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`block cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                selected === option.value
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start">
                <input
                  type="radio"
                  name="scale"
                  value={option.value}
                  checked={selected === option.value}
                  onChange={() => handleSelect(option.value)}
                  className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{option.label}</span>
                    <span className="text-sm font-medium text-teal-600">{option.fundingRange}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{option.description}</p>
                  <p className="mt-1 text-xs text-gray-500">{option.quorum}</p>
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="submit">Continue</Button>
        </div>
      </form>
    </div>
  );
}

export default StepScaleSelect;
