import React from 'react';
import {
	weightedSearch,
	unweightedSearch
} from '../algorithms/paths';
import { drawBorderWalls, recursiveDivision, recursiveDivisionTwoLayers } from '../algorithms/walls';
import type { CoordinateAndDirection } from "../models/models";
import { cn } from '@/lib/utils';

interface IBoardParameters {
	rows: number;
	columns: number;
	startCoordinate: CoordinateAndDirection;
	goalCoordinate: CoordinateAndDirection;
	pathAlgorithm: string;
	wallAlgorithm: string;
	shouldBuildWalls: boolean;
	setShouldBuildWalls: (buildWallsState: boolean) => void;
	shouldVisualizePathAlgorithm: boolean;
	setShouldVisualizePathAlgorithm: (visualizeState: boolean) => void;
	shouldResetBoard: boolean;
	setShouldResetBoard: (resetState: boolean) => void;
	shouldResetPath: boolean;
	setShouldResetPath: (resetState: boolean) => void;
	onError: (message: string | null) => void;
}

type CellKind = "empty" | "wall" | "start" | "goal";

// Full visual state for a single cell. `kind` is mutually exclusive
// (a cell is exactly one of empty/wall/start/goal); visited/pathFill/
// pathDirectionClass are independent overlays the search animation adds
// on top - a cell that was visited during search AND ends up on the final
// path carries all three at once, mirroring the original's additive
// className behavior (see paths.tsx's AnimationCallbacks).
interface CellState {
	kind: CellKind;
	visited: boolean;
	pathFill: boolean;
	pathDirectionClass: string | null;
}

function buildInitialCells(
	rows: number,
	columns: number,
	startCoordinate: CoordinateAndDirection,
	goalCoordinate: CoordinateAndDirection
): CellState[][] {
	const cells: CellState[][] = [];
	for (let i = 0; i < rows; i++) {
		const row: CellState[] = [];
		for (let j = 0; j < columns; j++) {
			let kind: CellKind = "empty";
			if (i === startCoordinate.row && j === startCoordinate.column) {
				kind = "start";
			}
			else if (i === goalCoordinate.row && j === goalCoordinate.column) {
				kind = "goal";
			}
			row.push({ kind, visited: false, pathFill: false, pathDirectionClass: null });
		}
		cells.push(row);
	}
	return cells;
}

function getCellClassName(cell: CellState): string {
	const classes: string[] = ["board-cell"];

	if (cell.kind === "start" || cell.kind === "goal") {
		classes.push("board-cell-anchor", "text-center");
	}
	if (cell.kind === "wall") {
		classes.push("wall-fill");
	}
	if (cell.visited) {
		classes.push("board-fill");
	}
	if (cell.pathFill) {
		classes.push("goal-path-fill");
	}
	if (cell.pathDirectionClass) {
		classes.push(cell.pathDirectionClass);
	}

	return cn(...classes);
}

const Board = ({
	rows, columns, startCoordinate, goalCoordinate, shouldBuildWalls, setShouldBuildWalls,
	pathAlgorithm, wallAlgorithm, shouldVisualizePathAlgorithm, setShouldVisualizePathAlgorithm,
	shouldResetBoard, setShouldResetBoard, shouldResetPath, setShouldResetPath, onError
}: IBoardParameters) => {

	// Contains all setTimeoutIds for the in-progress search animation, so an
	// immediate Reset can cancel them (clearTimeout) instead of letting them
	// keep firing and mutating state after the board's already been cleared.
	const timeoutIdsRef = React.useRef<NodeJS.Timeout[]>([]);

	// Contains all the walls on the board
	const walls = React.useRef<Set<string>>(new Set<string>());

	const [cells, setCells] = React.useState<CellState[][]>(() =>
		buildInitialCells(rows, columns, startCoordinate, goalCoordinate)
	);

	// Schedules a timed animation step for the search algorithms
	// (src/algorithms/paths.tsx) and tracks the timeout so it can be
	// cancelled on reset. paths.tsx owns the delay math; this just owns
	// bookkeeping/cancellation.
	const scheduleTimeout = React.useCallback((callback: () => void, delay: number): void => {
		const id = setTimeout(() => {
			callback();
			timeoutIdsRef.current = timeoutIdsRef.current.filter((existingId) => existingId !== id);
		}, delay);
		timeoutIdsRef.current.push(id);
	}, []);

	const cancelPendingTimeouts = (): void => {
		timeoutIdsRef.current.forEach((id) => clearTimeout(id));
		timeoutIdsRef.current = [];
	};

	const handleCellVisited = React.useCallback((row: number, column: number): void => {
		setCells((prev) => {
			const next = prev.map((r) => r.slice());
			next[row][column] = { ...next[row][column], visited: true };
			return next;
		});
	}, []);

	const handleGoalPathFill = React.useCallback((row: number, column: number): void => {
		setCells((prev) => {
			const next = prev.map((r) => r.slice());
			next[row][column] = { ...next[row][column], pathFill: true };
			return next;
		});
	}, []);

	const handlePathDirection = React.useCallback((row: number, column: number, directionClass: string): void => {
		setCells((prev) => {
			const next = prev.map((r) => r.slice());
			next[row][column] = { ...next[row][column], pathDirectionClass: directionClass };
			return next;
		});
	}, []);

	const animationCallbacks = React.useMemo(() => ({
		onCellVisited: handleCellVisited,
		onGoalPathFill: handleGoalPathFill,
		onPathDirection: handlePathDirection
	}), [handleCellVisited, handleGoalPathFill, handlePathDirection]);

	// Add/remove a wall at a coordinate (click/tap toggle)
	// if algorithm has already been run, you can't interact with the board again
	const toggleWall = (row: number, column: number): void => {
		if (shouldVisualizePathAlgorithm) return;

		const key = `${row}_${column}`;
		const isWall = walls.current.has(key);

		if (isWall) {
			walls.current.delete(key);
		}
		else {
			walls.current.add(key);
		}

		setCells((prev) => {
			const next = prev.map((r) => r.slice());
			next[row][column] = { ...next[row][column], kind: isWall ? "empty" : "wall" };
			return next;
		});
	}

	// Add a wall to the board (no click event - used by the recursive wall algorithms)
	const buildWall = (rowNum: number, columnNum: number): void => {
		const key = `${rowNum}_${columnNum}`;
		if (!walls.current.has(key)) {
			walls.current.add(key);
			setCells((prev) => {
				const next = prev.map((r) => r.slice());
				next[rowNum][columnNum] = { ...next[rowNum][columnNum], kind: "wall" };
				return next;
			});
		}
	}

	// Draw border walls and add inner walls recursively
	const addRecursiveWalls = (): void => {
		if(wallAlgorithm === "RecursiveDivision") {
			drawBorderWalls(startCoordinate, goalCoordinate, rows, columns, buildWall);
			recursiveDivision(0, startCoordinate, goalCoordinate, rows, columns, 1, 1, rows-2, columns-2, buildWall);
		}
		else if(wallAlgorithm === "RecursiveDivisionTwoLayers") {
			drawBorderWalls(startCoordinate, goalCoordinate, rows, columns, buildWall);
			recursiveDivisionTwoLayers(0, startCoordinate, goalCoordinate, rows, columns, 1, 1, rows-2, columns-2, buildWall);
		}
	}

	// Run the path finding algorithm
	// if algorithm has already been run, you can't run the algorithm again
	const runVisualizeAlgorithm = (): void => {
		let path = null;
		if(shouldVisualizePathAlgorithm) {
			onError(null);
			if(pathAlgorithm === "BreadthFirstSearch") {
				path = unweightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "BreadthFirstSearch", scheduleTimeout, animationCallbacks);
			}
			else if(pathAlgorithm === "DepthFirstSearch") {
				path = unweightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "DepthFirstSearch", scheduleTimeout, animationCallbacks);
			}
			else if(pathAlgorithm === "GreedyBestFirstSearch") {
				path = weightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "GreedyBestFirstSearch", scheduleTimeout, animationCallbacks);
			}
			else if(pathAlgorithm === "DijkstrasAlgorithm") {
				path = weightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "DijkstrasAlgorithm", scheduleTimeout, animationCallbacks);
			}
			else if(pathAlgorithm === "AStarAlgorithm") {
				path = weightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "AStarAlgorithm", scheduleTimeout, animationCallbacks);
			}

			if(path === null) {
				onError("No path was found. Please try again.");
			}
			else if(path.length === 0) {
				onError("The start is the goal. Please try again.");
			}
		}
	}

	// Creates the <rows> by <columns> board
	const createBoard = (): React.JSX.Element[] => {
		const maze: React.JSX.Element[] = [];

		for(let i=0; i<rows; i++) {
			const rowCells: React.JSX.Element[] = [];
			for(let j=0; j<columns; j++) {
				const cell = cells[i]?.[j] ?? { kind: "empty" as CellKind, visited: false, pathFill: false, pathDirectionClass: null };
				const interactive = cell.kind === "empty" || cell.kind === "wall";

				rowCells.push(
					<td
						key={j}
						id={i.toString() + "_" + j.toString()}
						className={getCellClassName(cell)}
						onClick={interactive ? () => toggleWall(i, j) : undefined}
						onTouchEnd={interactive ? (event) => { event.preventDefault(); toggleWall(i, j); } : undefined}
					>
						{cell.kind === "start" ? "S" : cell.kind === "goal" ? "G" : null}
					</td>
				);
			}
			maze.push(<tr key={i}>{rowCells}</tr>);
		}

		return maze;
	}

	// Clears the visited/path overlay from every cell, leaving wall/start/goal
	// kind untouched.
	const clearAlgorithmState = (): void => {
		setCells((prev) => prev.map((row) => row.map((cell) => ({
			...cell,
			visited: false,
			pathFill: false,
			pathDirectionClass: null
		}))));
	}

	// Resets the algorithm path created. Cancels any in-flight animation
	// timeouts first so a reset mid-visualization takes effect immediately
	// instead of being overwritten by callbacks still in flight.
	const resetPath = (): void => {
		cancelPendingTimeouts();
		clearAlgorithmState();
	}

	// Resets the entirety of the board (walls, paths, etc)
	const resetBoard = (): void => {
		cancelPendingTimeouts();
		walls.current.clear();
		setCells(buildInitialCells(rows, columns, startCoordinate, goalCoordinate));
	}

	// Check if walls can/should be built
	React.useEffect(() => {
		if(shouldBuildWalls && timeoutIdsRef.current.length === 0) {
			addRecursiveWalls();
		}
		else {
			setShouldBuildWalls(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldBuildWalls, timeoutIdsRef]);

	// Check if algorithm can/should be run
	React.useEffect(() => {
		if(shouldVisualizePathAlgorithm && timeoutIdsRef.current.length === 0) {
			runVisualizeAlgorithm();
		}
		else {
			setShouldVisualizePathAlgorithm(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldVisualizePathAlgorithm, timeoutIdsRef]);

	// Check if board path can/should be reset. Unlike build/visualize above,
	// this is never gated on pending timeouts - a reset always takes effect
	// immediately (cancelling any in-flight animation), rather than being
	// silently dropped while a visualization is still animating.
	React.useEffect(() => {
		if(shouldResetPath) {
			// shouldResetPath is an external one-shot command signal from the
			// parent (a button click), not state derivable during render -
			// synchronizing local cell state to it is exactly what this effect
			// is for.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			resetPath();
			setShouldVisualizePathAlgorithm(false);
			setShouldResetPath(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldResetPath]);

	// Check if board should be reset - same immediate-cancellation behavior
	// as resetPath above.
	React.useEffect(() => {
		if(shouldResetBoard) {
			// Same rationale as resetPath above - shouldResetBoard is an
			// external one-shot command signal, not derivable render state.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			resetBoard();
			setShouldVisualizePathAlgorithm(false);
			setShouldResetPath(false);
			setShouldBuildWalls(false);
			setShouldResetBoard(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldResetBoard]);

	// Create board
	const board = createBoard();

	return (
		<div>
			<div>

				{/* Board area */}
				<table className="mt-3 mr-2 ml-0">
					<tbody>
						{board}
					</tbody>
				</table>

			</div>
		</div>
	);
}

const BoardConfigurationsAreEqual = (prevProps: IBoardParameters, nextProps: IBoardParameters) => {
	const {
		shouldBuildWalls: prevBuildWalls,
		shouldVisualizePathAlgorithm: prevVisualizePath,
		shouldResetPath: prevResetPath,
		shouldResetBoard: prevResetBoard
	} = prevProps;

	const {
		shouldBuildWalls: nextBuildWalls,
		shouldVisualizePathAlgorithm: nextVisualizePath,
		shouldResetPath: nextResetPath,
		shouldResetBoard: nextResetBoard
	} = nextProps;

	return prevBuildWalls === nextBuildWalls &&
	prevVisualizePath === nextVisualizePath &&
	prevResetPath === nextResetPath &&
	prevResetBoard === nextResetBoard
}

const BoardMemo = React.memo(Board, BoardConfigurationsAreEqual);

export default BoardMemo;
