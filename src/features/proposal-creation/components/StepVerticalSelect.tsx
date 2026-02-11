/**
 * Step 3: Vertical Selection
 *
 * Dropdown selection for project vertical/category.
 * Used to categorize the proposal and route to appropriate reviewers.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 3
 */

import React, { useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import type { ProposalVertical } from '@/stores';

interface VerticalOption {
  value: ProposalVertical;
  label: string;
  description: string;
  icon: string;
}

const VERTICAL_OPTIONS: VerticalOption[] = [
  {
    value: 'Housing',
    label: 'Housing',
    description: 'Affordable housing, co-living spaces, home improvements',
    icon: '🏠',
  },
  {
    value: 'Food',
    label: 'Food',
    description: 'Community gardens, food programs, local agriculture',
    icon: '🌱',
  },
  {
    value: 'Energy',
    label: 'Energy',
    description: 'Renewable energy, efficiency projects, utilities',
    icon: '⚡',
  },
  {
    value: 'Education',
    label: 'Education',
    description: 'Training programs, workshops, skill development',
    icon: '📚',
  },
  {
    value: 'Community',
    label: 'Community',
    description: 'Events, social programs, neighborhood improvements',
    icon: '🤝',
  },
  {
    value: 'Infrastructure',
    label: 'Infrastructure',
    description: 'Shared facilities, equipment, technology',
    icon: '🔧',
  },
  {
    value: 'Other',
    label: 'Other',
    description: "Projects that don't fit other categories",
    icon: '📋',
  },
];

interface StepVerticalSelectProps {
  initialValue?: ProposalVertical;
  onNext: (vertical: ProposalVertical) => void;
  onBack: () => void;
  /** Called when the vertical value changes (for auto-save) */
  onChange?: (vertical: ProposalVertical) => void;
}

export function StepVerticalSelect({
  initialValue = 'Community',
  onNext,
  onBack,
  onChange,
}: StepVerticalSelectProps) {
  const [selected, setSelected] = React.useState<ProposalVertical>(initialValue);

  // Sync with initialValue when it changes (e.g., when resuming a draft)
  useEffect(() => {
    if (initialValue) {
      setSelected(initialValue);
    }
  }, [initialValue]);

  // Handle selection change
  const handleSelect = (vertical: ProposalVertical) => {
    setSelected(vertical);
    // Notify parent for auto-save
    if (onChange && vertical !== initialValue) {
      onChange(vertical);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(selected);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Select Project Category</h2>
        <p className="mt-2 text-gray-600">Choose the category that best describes your project.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VERTICAL_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start rounded-lg border-2 p-4 transition-colors ${
                selected === option.value
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="vertical"
                value={option.value}
                checked={selected === option.value}
                onChange={() => handleSelect(option.value)}
                className="sr-only"
              />
              <span className="mr-3 text-2xl">{option.icon}</span>
              <div className="flex-1">
                <span className="block font-semibold text-gray-900">{option.label}</span>
                <span className="mt-1 block text-sm text-gray-600">{option.description}</span>
              </div>
              {selected === option.value && (
                <svg className="h-5 w-5 text-teal-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </label>
          ))}
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="submit">Generate Proposal</Button>
        </div>
      </form>
    </div>
  );
}

export default StepVerticalSelect;
