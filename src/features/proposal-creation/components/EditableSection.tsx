/**
 * Editable Section Component
 *
 * Wrapper for section content that enables inline editing.
 * Tracks edited state and integrates with draft state.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 8
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../../components/ui/button';

interface EditableSectionProps {
  value: string;
  onChange: (value: string) => void;
  isEdited: boolean;
  placeholder?: string;
  multiline?: boolean;
}

export function EditableSection({
  value,
  onChange,
  isEdited: _isEdited,
  placeholder = 'Enter content...',
  multiline = true,
}: EditableSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update edit value when prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus and select on edit start
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={multiline ? 6 : 2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Press ⌘+Enter to save, Escape to cancel</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div
        onClick={() => setIsEditing(true)}
        className="cursor-pointer rounded-md p-2 -m-2 hover:bg-gray-50 transition-colors"
      >
        <p className="text-gray-700 whitespace-pre-wrap">
          {value || <span className="text-gray-400 italic">{placeholder}</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-600"
        title="Click to edit"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </button>
    </div>
  );
}

export default EditableSection;
