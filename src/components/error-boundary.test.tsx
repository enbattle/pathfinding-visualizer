import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './error-boundary';

// Throws from an effect the first `failures` times it mounts - the way a
// WebGL context that can't be created fails in the 3D view.
function makeFlakyChild(failures: number) {
  let mounts = 0;
  return function FlakyChild() {
    React.useEffect(() => {
      mounts++;
      if (mounts <= failures) throw new Error('WebGL context failed');
    }, []);
    return <p>3D view</p>;
  };
}

describe('ErrorBoundary', () => {
  it('contains a failure to its own subtree, and retry remounts it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const FlakyChild = makeFlakyChild(1);
    render(
      <div>
        <p>rest of the page</p>
        <ErrorBoundary
          fallback={retry => (
            <button type="button" onClick={retry}>
              Try again
            </button>
          )}
        >
          <FlakyChild />
        </ErrorBoundary>
      </div>
    );

    expect(screen.getByText('rest of the page')).toBeInTheDocument();
    expect(screen.queryByText('3D view')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('3D view')).toBeInTheDocument();
    expect(screen.getByText('rest of the page')).toBeInTheDocument();
  });
});
