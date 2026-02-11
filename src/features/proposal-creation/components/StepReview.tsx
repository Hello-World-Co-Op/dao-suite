/**
 * Step 5: Review Generated Proposal
 *
 * Displays all generated sections in accordion format.
 * Allows inline editing and section refinement.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 6, 7, 8
 */

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import type { ThinkTankOutput, BudgetItem, TimelineItem, RiskItem } from '@/stores';

interface StepReviewProps {
  output: ThinkTankOutput;
  isRefining: boolean;
  onRefine: (section: keyof ThinkTankOutput, feedback: string) => Promise<void>;
  onEdit: (section: keyof ThinkTankOutput, value: ThinkTankOutput[keyof ThinkTankOutput]) => void;
  onSubmit: () => void;
  onBack: () => void;
  editedSections: (keyof ThinkTankOutput)[];
}

interface SectionProps {
  title: string;
  sectionKey: keyof ThinkTankOutput;
  isEdited: boolean;
  isRefining: boolean;
  onRefine: (feedback: string) => Promise<void>;
  children: React.ReactNode;
}

function Section({
  title,
  sectionKey: _sectionKey,
  isEdited,
  isRefining,
  onRefine,
  children,
}: SectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRefineForm, setShowRefineForm] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState('');

  const handleRefine = async () => {
    if (!refineFeedback.trim()) return;
    await onRefine(refineFeedback);
    setRefineFeedback('');
    setShowRefineForm(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{title}</span>
          {isEdited && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Edited</span>
          )}
        </div>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          {children}

          <div className="mt-4 border-t border-gray-100 pt-4">
            {!showRefineForm ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRefineForm(true)}
                disabled={isRefining}
              >
                Refine with AI
              </Button>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={refineFeedback}
                  onChange={(e) => setRefineFeedback(e.target.value)}
                  placeholder="Describe what you'd like to change..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRefine}
                    disabled={isRefining || !refineFeedback.trim()}
                  >
                    {isRefining ? 'Refining...' : 'Apply'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowRefineForm(false);
                      setRefineFeedback('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetTable({ items }: { items: BudgetItem[] }) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Category
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
              Amount
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Description
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item, idx) => (
            <tr key={idx}>
              <td className="px-4 py-2 text-sm text-gray-900">{item.category}</td>
              <td className="px-4 py-2 text-sm text-gray-900 text-right">
                {item.amount.toLocaleString()} DOM
              </td>
              <td className="px-4 py-2 text-sm text-gray-600">{item.description}</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-medium">
            <td className="px-4 py-2 text-sm text-gray-900">Total</td>
            <td className="px-4 py-2 text-sm text-gray-900 text-right">
              {total.toLocaleString()} DOM
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TimelineDisplay({ items }: { items: TimelineItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-sm font-medium text-white">
              {idx + 1}
            </div>
            {idx < items.length - 1 && <div className="h-full w-0.5 bg-gray-200" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{item.phase}</span>
              <span className="text-sm text-gray-500">({item.duration})</span>
            </div>
            <ul className="mt-2 list-disc list-inside text-sm text-gray-600">
              {item.deliverables.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskMatrix({ items }: { items: RiskItem[] }) {
  const getLevelColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
    }
  };

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-start justify-between">
            <span className="font-medium text-gray-900">{item.risk}</span>
            <div className="flex gap-2">
              <span className={`rounded px-2 py-0.5 text-xs ${getLevelColor(item.likelihood)}`}>
                L: {item.likelihood}
              </span>
              <span className={`rounded px-2 py-0.5 text-xs ${getLevelColor(item.impact)}`}>
                I: {item.impact}
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium">Mitigation:</span> {item.mitigation}
          </p>
        </div>
      ))}
    </div>
  );
}

export function StepReview({
  output,
  isRefining,
  onRefine,
  onEdit: _onEdit,
  onSubmit,
  onBack,
  editedSections,
}: StepReviewProps) {
  const handleRefine = (section: keyof ThinkTankOutput) => async (feedback: string) => {
    await onRefine(section, feedback);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Review Your Proposal</h2>
        <p className="mt-2 text-gray-600">
          Review the AI-generated content below. You can edit any section or request AI refinement.
        </p>
      </div>

      <div className="space-y-4">
        <Section
          title="Problem Statement"
          sectionKey="problemStatement"
          isEdited={editedSections.includes('problemStatement')}
          isRefining={isRefining}
          onRefine={handleRefine('problemStatement')}
        >
          <p className="text-gray-700 whitespace-pre-wrap">{output.problemStatement}</p>
        </Section>

        <Section
          title="Proposed Solution"
          sectionKey="proposedSolution"
          isEdited={editedSections.includes('proposedSolution')}
          isRefining={isRefining}
          onRefine={handleRefine('proposedSolution')}
        >
          <p className="text-gray-700 whitespace-pre-wrap">{output.proposedSolution}</p>
        </Section>

        <Section
          title="Budget Breakdown"
          sectionKey="budgetBreakdown"
          isEdited={editedSections.includes('budgetBreakdown')}
          isRefining={isRefining}
          onRefine={handleRefine('budgetBreakdown')}
        >
          <BudgetTable items={output.budgetBreakdown} />
        </Section>

        <Section
          title="Timeline"
          sectionKey="timeline"
          isEdited={editedSections.includes('timeline')}
          isRefining={isRefining}
          onRefine={handleRefine('timeline')}
        >
          <TimelineDisplay items={output.timeline} />
        </Section>

        <Section
          title="Success Metrics"
          sectionKey="successMetrics"
          isEdited={editedSections.includes('successMetrics')}
          isRefining={isRefining}
          onRefine={handleRefine('successMetrics')}
        >
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {output.successMetrics.map((metric, idx) => (
              <li key={idx}>{metric}</li>
            ))}
          </ul>
        </Section>

        <Section
          title="Risk Assessment"
          sectionKey="riskAssessment"
          isEdited={editedSections.includes('riskAssessment')}
          isRefining={isRefining}
          onRefine={handleRefine('riskAssessment')}
        >
          <RiskMatrix items={output.riskAssessment} />
        </Section>

        <Section
          title="Think Tank Contributions"
          sectionKey="agentContributions"
          isEdited={editedSections.includes('agentContributions')}
          isRefining={isRefining}
          onRefine={handleRefine('agentContributions')}
        >
          <div className="space-y-2">
            {output.agentContributions.map((contrib, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="font-medium text-teal-600">{contrib.agent}:</span>
                <span className="text-gray-700">{contrib.contribution}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back to Edit
        </Button>
        <Button type="button" onClick={onSubmit}>
          Submit Proposal
        </Button>
      </div>
    </div>
  );
}

export default StepReview;
