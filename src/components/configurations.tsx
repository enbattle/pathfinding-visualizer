import React from "react";
import Board from "./board";
import { randIntBetween } from '../util/function-util';
import { CoordinateAndDirection } from "../models/models";

// Get the window width and height to size the board
const {innerWidth, innerHeight} = window;

const Configuration = () => {

	// Static rows and columns for the board
	const rows = Math.floor(innerHeight / 30) >= 20 ? Math.floor(innerHeight / 30) : 20;
	const columns = Math.floor(innerWidth / 36) >= 20 ? Math.floor(innerWidth / 36) : 20;

	// Initialize board states
	const [pathAlgorithm, setPathAlgorithm] = React.useState<string>("BreadthFirstSearch");
	const [wallAlgorithm, setWallAlgorithm] = React.useState<string>("RecursiveDivision");
	const [shouldBuildWalls, setShouldBuildWalls] = React.useState<boolean>(false);
	const [shouldVisualizePathAlgorithm, setShouldVisualizePathAlgorithm] = React.useState<boolean>(false);
	const [shouldResetBoard, setShouldResetBoard] = React.useState<boolean>(false);
	const [shouldResetPath, setShouldResetPath] = React.useState<boolean>(false);

	// Start state
	const [startCoordinate, setStartCoordinate] = React.useState<CoordinateAndDirection>({
		row: rows-1,
		column: randIntBetween(1, Math.floor(columns / 2)),
		direction: ""
	});

	// Goal state
	const [goalCoordinate, setGoalCoordinate] = React.useState<CoordinateAndDirection>({
		row: 0,
		column: randIntBetween(Math.floor(columns / 2), columns - 2),
		direction: ""
	});

	// Handle algorithm select input change
	const handlePathAlgorithmChange = (event: { target: any }): void => {
		setPathAlgorithm(event.target.value);
	}

		// Handle algorithm select input change
		const handleWallAlgorithmChange = (event: { target: any }): void => {
			setWallAlgorithm(event.target.value);
		}

	return (
		<div className="container">

			{/* Menu Area */}
			<div className="menu">
				<h1 className="menu-title">Pathfinder Visualizer</h1>
				
				{/* Ask the user for rows, columns, and algorithms */}
				<form>

					{/* Wall Algorithm type */}
					<label htmlFor="wallAlgorithmChoices" className="menu-algorithm__label">Type of Wall Algorithm</label>
					<div className="menu-algorithm padding-y">
						<select 
							id="wallAlgorithmChoices"
							name="wallAlgorithm"
							aria-label="Wall Algorithm Choices"
							value={wallAlgorithm}
							className="menu-algorithm__options"
							onChange={handleWallAlgorithmChange}
						>
							<option value="RecursiveDivision">Recursive Division</option>
							<option value="RecursiveDivisionTwoLayers">Twin Recursive Division</option>
						</select>
						<span className="focus"></span>
					</div>
					<div className="padding-bottom margin-bottom border-bottom">
						<input className="build-walls-button" type="button" value="Build Walls" onClick={() => setShouldBuildWalls(true)} />
					</div>

					{/* Path Algorithm type */}
					<label htmlFor="pathAlgorithmChoices" className="menu-algorithm__label padding-top">Type of Path Algorithm</label>
					<div className="menu-algorithm padding-y">
						<select 
							id="pathAlgorithmChoices"
							name="pathAlgorithm"
							aria-label="Path Algorithm Choices"
							value={pathAlgorithm}
							className="menu-algorithm__options"
							onChange={handlePathAlgorithmChange}
						>
							<option value="BreadthFirstSearch">Breadth-first Search</option>
							<option value="DepthFirstSearch">Depth-first Search</option>
							<option value="GreedyBestFirstSearch">Greedy Best-First Search</option>
							<option value="DijkstrasAlgorithm">Dijkstra's Algorithm</option>
							<option value="AStarAlgorithm">A* Algorithm</option>
						</select>
						<span className="focus"></span>
					</div>
					<div className="padding-bottom border-bottom">
						<input className="visualize-button" type="button" value="Visualize" onClick={() => setShouldVisualizePathAlgorithm(true)}/>
					</div>

					<div>
						<div className="padding-y">
							<input className="reset-start-goal-button" type="button" value="Reset Start/Goal" onClick={() => {
								setStartCoordinate({
									row: rows-1,
									column: randIntBetween(1, Math.floor(columns / 2)),
									direction: ""
								});
								setGoalCoordinate({
									row: 0,
									column: randIntBetween(Math.floor(columns / 2), columns - 2),
									direction: ""
								});
								setShouldResetBoard(true);
							}}/>
							<input className="reset-path-button" type="button" value="Reset Path" onClick={() => setShouldResetPath(true)}/>
							<input className="reset-all-button" type="button" value="Reset All" onClick={() => setShouldResetBoard(true)}/>
						</div>
					</div>
				</form>
			</div>

			{/* Board Area */}
			<Board 
				rows={rows}
				columns={columns}
				startCoordinate={startCoordinate}
				goalCoordinate={goalCoordinate}
				pathAlgorithm={pathAlgorithm}
				wallAlgorithm={wallAlgorithm}
				shouldBuildWalls={shouldBuildWalls}
				setShouldBuildWalls={setShouldBuildWalls}
				shouldVisualizePathAlgorithm={shouldVisualizePathAlgorithm}
				setShouldVisualizePathAlgorithm={setShouldVisualizePathAlgorithm}
				shouldResetBoard={shouldResetBoard}
				setShouldResetBoard={setShouldResetBoard}
				shouldResetPath={shouldResetPath}
				setShouldResetPath={setShouldResetPath}
			/>
		</div>
	);
}

export default Configuration;