import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn utility', () => {
  it('merges multiple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes with falsy values', () => {
    const falsyCondition = false;
    expect(cn('foo', falsyCondition && 'bar', 'baz')).toBe('foo baz');
    expect(cn('foo', null, 'baz')).toBe('foo baz');
    expect(cn('foo', undefined, 'baz')).toBe('foo baz');
  });

  it('handles conditional classes with truthy values', () => {
    const truthyCondition = true;
    expect(cn('foo', truthyCondition && 'bar', 'baz')).toBe('foo bar baz');
  });

  it('handles arrays of classes', () => {
    const falsyCondition = false;
    expect(cn(['foo', 'bar'])).toBe('foo bar');
    expect(cn(['foo', falsyCondition && 'bar', 'baz'])).toBe('foo baz');
  });

  it('handles objects with boolean values', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('handles mixed inputs', () => {
    expect(cn('foo', ['bar', 'baz'], { qux: true, quux: false })).toBe('foo bar baz qux');
  });

  it('handles empty inputs', () => {
    expect(cn()).toBe('');
    expect(cn('')).toBe('');
    expect(cn(null, undefined, false)).toBe('');
  });

  it('handles duplicate class names', () => {
    expect(cn('foo', 'foo')).toBe('foo foo');
  });

  it('handles whitespace in class names', () => {
    // clsx preserves whitespace, it doesn't trim
    expect(cn('  foo  ', 'bar')).toBe('  foo   bar');
  });

  it('works with Tailwind CSS classes', () => {
    expect(cn('bg-blue-500', 'text-white', 'p-4')).toBe('bg-blue-500 text-white p-4');
  });

  it('works with conditional Tailwind classes', () => {
    const isActive = true;
    const isDisabled = false;

    expect(cn('btn', isActive && 'btn-active', isDisabled && 'btn-disabled')).toBe(
      'btn btn-active'
    );
  });
});
