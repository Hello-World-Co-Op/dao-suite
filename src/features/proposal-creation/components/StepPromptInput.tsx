/**
 * Step 1: Project Idea Input
 *
 * Free-form text input for the project prompt with validation.
 * Min 50 chars, max 2000 chars.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 2
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../../components/ui/button';

const promptSchema = z.object({
  prompt: z
    .string()
    .min(50, 'Please provide more detail (minimum 50 characters)')
    .max(2000, 'Please be more concise (maximum 2000 characters)'),
});

type PromptFormData = z.infer<typeof promptSchema>;

interface StepPromptInputProps {
  initialValue?: string;
  onNext: (prompt: string) => void;
  onBack?: () => void;
  /** Called when the prompt value changes (for auto-save) */
  onChange?: (prompt: string) => void;
}

export function StepPromptInput({
  initialValue = '',
  onNext,
  onBack,
  onChange,
}: StepPromptInputProps) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<PromptFormData>({
    resolver: zodResolver(promptSchema),
    mode: 'onChange',
    defaultValues: { prompt: initialValue },
  });

  // Reset form when initialValue changes (e.g., when resuming a draft)
  useEffect(() => {
    if (initialValue) {
      reset({ prompt: initialValue });
    }
  }, [initialValue, reset]);

  const promptValue = watch('prompt');
  const charCount = promptValue?.length ?? 0;

  // Notify parent of changes for auto-save
  useEffect(() => {
    // Only trigger onChange if value differs from initial and is not empty
    if (onChange && promptValue && promptValue !== initialValue) {
      onChange(promptValue);
    }
  }, [promptValue, initialValue, onChange]);

  const onSubmit = (data: PromptFormData) => {
    onNext(data.prompt);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Describe Your Project</h2>
        <p className="mt-2 text-gray-600">
          Tell us about your idea. What problem are you solving? What impact do you want to make?
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">
            Project Description
          </label>
          <textarea
            id="prompt"
            {...register('prompt')}
            rows={8}
            className={`mt-1 block w-full rounded-md border ${
              errors.prompt ? 'border-red-500' : 'border-gray-300'
            } px-3 py-2 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500`}
            placeholder="Example: I want to create a community solar project that provides affordable renewable energy to low-income households in our neighborhood. The project would install solar panels on community buildings and distribute the energy savings to participating families..."
          />
          <div className="mt-1 flex justify-between">
            <span className={`text-sm ${errors.prompt ? 'text-red-500' : 'text-gray-500'}`}>
              {errors.prompt?.message ?? ' '}
            </span>
            <span
              className={`text-sm ${charCount < 50 ? 'text-amber-600' : charCount > 2000 ? 'text-red-500' : 'text-gray-500'}`}
            >
              {charCount} / 2000
            </span>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          {onBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="submit" disabled={!isValid} className="ml-auto">
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}

export default StepPromptInput;
