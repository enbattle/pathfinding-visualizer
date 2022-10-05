import React from 'react';
import { 
	weightedSearch,
	unweightedSearch
} from '../algorithms/paths';
import { drawBorderWalls, recursiveDivision, recursiveDivisionTwoLayers } from '../algorithms/walls';
import { CoordinateAndDirection } from "../models/models";

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
}

const Board = ({
	rows, columns, startCoordinate, goalCoordinate, shouldBuildWalls, setShouldBuildWalls,
	pathAlgorithm, wallAlgorithm, shouldVisualizePathAlgorithm, setShouldVisualizePathAlgorithm,
	shouldResetBoard, setShouldResetBoard, shouldResetPath, setShouldResetPath
}: IBoardParameters) => {

	/**
	 * boardRef contains all of the table cell elements (<td>) as a single linear array.
	 * 
	 * A table is usually <x> rows by <y> columns, so as a single linear array, it would just be <x> * <y> total columns.
	 * 
	 * To get to the necessary table cell element by their id in the array, just use the following
	 * equation based on the current coordinate: 
	 * 
	 * index = (<board row value> * <total number of columns>) + <board column value>
	 */
	const boardRef = React.useRef<HTMLTableCellElement[]>([]);

	// Contains all setTimeoutIds for filling the board
	const timeoutIdsRef = React.useRef<NodeJS.Timeout[]>([]);

	// Contains all the walls on the board
	const walls = React.useRef<Set<string>>(new Set<string>());

	// Add a wall to the board (through click event)
	// if algorithm has already been run, you can't interact with the board again
	const addWall = (event: { target: any; }): void => {
		if(!shouldVisualizePathAlgorithm) {
			let addingWall: boolean;

			// ID of each board coordinate is in the string form "row_column"
			let boardCoordinates = event.target.id.split("_");
			let currentRow = parseInt(boardCoordinates[0]);
			let currentColumn = parseInt(boardCoordinates[1]);

			// Show that the user clicked on a wall
			if(boardRef.current[(currentRow * columns) + currentColumn].className.includes("wall-fill")) {
				boardRef.current[(currentRow * columns) + currentColumn].className = "regular board-table__cell";
				addingWall = false;
			}
			else {
				boardRef.current[(currentRow * columns) + currentColumn].className += " wall-fill";
				addingWall = true;
			}

			let newWall = boardCoordinates[0] + "_" + boardCoordinates[1];
			if(addingWall) {
				// Add wall to the set
				walls.current.add(newWall);
			}
			else {
				// Remove wall from the set
				walls.current.delete(newWall);
			}
		}
	}

	// Add a wall to the board (no click event)
	const buildWall = (rowNum: number, columnNum: number): void => {
		if(!boardRef.current[(rowNum * columns) + columnNum].className.includes("wall-fill")) {
			boardRef.current[(rowNum * columns) + columnNum].className += " wall-fill";
		}

		let newWall = rowNum.toString() + "_" + columnNum.toString();
		
		// Add wall to the set
		walls.current.add(newWall);
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
			if(pathAlgorithm === "BreadthFirstSearch") {
				path = unweightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "BreadthFirstSearch", boardRef, timeoutIdsRef);
			}
			else if(pathAlgorithm === "DepthFirstSearch") {
				path = unweightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "DepthFirstSearch", boardRef, timeoutIdsRef);
			}
			else if(pathAlgorithm === "GreedyBestFirstSearch") {
				path = weightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "GreedyBestFirstSearch", boardRef, timeoutIdsRef);
			}
			else if(pathAlgorithm === "DijkstrasAlgorithm") {
				path = weightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "DijkstrasAlgorithm", boardRef, timeoutIdsRef);
			}
			else if(pathAlgorithm === "AStarAlgorithm") {
				path = weightedSearch(rows, columns, startCoordinate, goalCoordinate, walls.current, "AStarAlgorithm", boardRef, timeoutIdsRef);
			}

			if(path === null) {
				alert("No path was found. Please try again.");
			}
			else if(path.length === 0) {
				alert("The start is the goal. Please try again.")
			}
		}
	}

	// Creates the <rows> by <columns> board
	const createBoard = (): JSX.Element[] => {
		// Initialize board
		const maze: JSX.Element[] = [];

		// Create board
		for(let i=0; i<rows; i++) {
			let cells: JSX.Element[] = [];
			for(let j=0; j<columns; j++) {
				if(i === startCoordinate.row && j === startCoordinate.column) { // Start
					cells.push(
						<td
							key={j}
							ref={(element) => {
								if(element) boardRef.current.push(element);
							}}
							id={i.toString() + "_" + j.toString()}
							className="start text-center"
						>S</td>
					);
				}
				else if(i === goalCoordinate.row && j === goalCoordinate.column) { // Goal
					cells.push(
						<td
							key={j}
							ref={(element) => {
								if(element) boardRef.current.push(element);
							}}
							id={i.toString() + "_" + j.toString()}
							className="goal text-center"
						>G</td>);
				}
				else { // All other cells
					cells.push(
						<td 
							key={j}
							ref={(element) => {
								if(element) boardRef.current.push(element);
							}}
							id={i.toString() + "_" + j.toString()}
							className="board-table__cell"
							onClick={addWall}
						></td>
					);
				}
			}
			maze.push(<tr key={i}>{cells}</tr>);
		}

		return maze;
	}

	// Resets the algorithm path created
	const resetPath = (): void => {
		for(let i=0; i<boardRef.current.length; i++) {
			if(boardRef.current[i].className.includes("board-fill") || boardRef.current[i].className.includes("goal-path-fill")) {
				boardRef.current[i].className = "regular board-table__cell";
			}
		}
	}

	// Resets the entirety of the board (walls, paths, etc)
	const resetBoard = (): void => {
		walls.current.clear();

		for(let i=0; i<boardRef.current.length; i++) {
			if(boardRef.current[i].className.includes("start")) {
				boardRef.current[i].className = "start text-center";
			}
			else if(boardRef.current[i].className.includes("goal") && !boardRef.current[i].className.includes("goal-path-fill")) {
				boardRef.current[i].className = "goal text-center";
			}
			else {
				boardRef.current[i].className = "regular board-table__cell";
			}
		}
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

	// Check if board path can/should be reset
	React.useEffect(() => {
		if(shouldResetPath && timeoutIdsRef.current.length === 0) {
			resetPath();
			setShouldVisualizePathAlgorithm(false);
			setShouldResetPath(false);
		}
		else {
			setShouldResetPath(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldResetPath, timeoutIdsRef]);

	// Check if board should be reset
	React.useEffect(() => {
		if(shouldResetBoard && timeoutIdsRef.current.length === 0) {
			resetBoard();
			setShouldVisualizePathAlgorithm(false);
			setShouldResetPath(false);
			setShouldBuildWalls(false);
			setShouldResetBoard(false);
		}
		else {
			setShouldResetBoard(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldResetBoard, timeoutIdsRef]);

	// Create board
	const board = createBoard();

	return (
		<div>
			<div>

				{/* Board area */}
				<table className="board-table">
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