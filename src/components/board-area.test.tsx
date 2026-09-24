import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FakeClock } from '../test-support/fake-clock';
import { Visualizer } from '../visualizer/visualizer';
import { BoardArea } from './board-area';

// The first attempt to download the 3D view fails (as with a dropped
// connection); the second succeeds.
const { load3DView } = vi.hoisted(() => ({ load3DView: vi.fn() }));
vi.mock('./board-3d/load', () => ({ load3DView }));

describe('BoardArea 3D view', () => {
  it('"Try again" really retries a 3D view that failed to download', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    load3DView
      .mockRejectedValueOnce(
        new TypeError('Failed to fetch dynamically imported module')
      )
      .mockResolvedValueOnce({ default: () => <p>3D view loaded</p> });

    const visualizer = new Visualizer({
      rows: 5,
      columns: 5,
      start: 6,
      goal: 18,
      clock: new FakeClock(),
    });
    render(<BoardArea visualizer={visualizer} paintMode="wall" />);

    fireEvent.click(screen.getByRole('button', { name: '3D' }));
    expect(await screen.findByText(/couldn't start/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('3D view loaded')).toBeInTheDocument();
    expect(load3DView).toHaveBeenCalledTimes(2);
  });
});
