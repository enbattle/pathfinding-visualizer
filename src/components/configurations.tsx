import React from "react";
import BoardMemo from "./board";
import { randIntBetween } from '../util/function-util';
import type { CoordinateAndDirection } from "../models/models";
import { AiFillInfoCircle } from 'react-icons/ai';
import { TbMoodCrazyHappy } from 'react-icons/tb';
import { GiBrickWall, GiPathDistance, GiStairsGoal } from 'react-icons/gi';
import { BiRefresh } from 'react-icons/bi';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Computes the board size (rows/columns) from the current viewport.
function computeBoardSize(): { rows: number; columns: number } {
	const rows = Math.floor(window.innerHeight / 30) >= 20 ? Math.floor(window.innerHeight / 30) : 20;
	const columns = Math.floor(window.innerWidth / 36) >= 20 ? Math.floor(window.innerWidth / 36) : 20;
	return { rows, columns };
}

// Placed one cell inside the outer border (drawn by drawBorderWalls) rather
// than on it - a border cell only has 2-3 real neighbors instead of 4, which
// lets the maze wall it in completely even though recursiveDivision's
// exclusion-zone logic guarantees connectivity for the interior region.
function randomStartCoordinate(rows: number, columns: number): CoordinateAndDirection {
	return {
		row: rows-2,
		column: randIntBetween(1, Math.floor(columns / 2)),
		direction: ""
	};
}

function randomGoalCoordinate(rows: number, columns: number): CoordinateAndDirection {
	return {
		row: 1,
		column: randIntBetween(Math.floor(columns / 2), columns - 2),
		direction: ""
	};
}

const Configuration = () => {

	// Board size - recomputed on window resize so orientation/window changes
	// are reflected rather than being frozen at the size on first mount.
	const [{ rows, columns }, setBoardSize] = React.useState(computeBoardSize);

	React.useEffect(() => {
		const handleResize = () => setBoardSize(computeBoardSize());
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// Initialize board states
	const [pathAlgorithm, setPathAlgorithm] = React.useState<string>("BreadthFirstSearch");
	const [wallAlgorithm, setWallAlgorithm] = React.useState<string>("RecursiveDivision");
	const [shouldBuildWalls, setShouldBuildWalls] = React.useState<boolean>(false);
	const [shouldVisualizePathAlgorithm, setShouldVisualizePathAlgorithm] = React.useState<boolean>(false);
	const [shouldResetBoard, setShouldResetBoard] = React.useState<boolean>(false);
	const [shouldResetPath, setShouldResetPath] = React.useState<boolean>(false);

	// Info Modal state
	const [openInfoModal, setOpenInfoModal] = React.useState<boolean>(false);

	// Algorithm-run error state (e.g. no path found)
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

	// Start state
	const [startCoordinate, setStartCoordinate] = React.useState<CoordinateAndDirection>(() =>
		randomStartCoordinate(rows, columns)
	);

	// Goal state
	const [goalCoordinate, setGoalCoordinate] = React.useState<CoordinateAndDirection>(() =>
		randomGoalCoordinate(rows, columns)
	);

	// Handle algorithm select input change
	const handlePathAlgorithmChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
		setPathAlgorithm(event.target.value);
	}

	// Handle algorithm select input change
	const handleWallAlgorithmChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
		setWallAlgorithm(event.target.value);
	}

	return (
		<div className="flex">

			{/* Menu Area */}
			<div className={cn("menu-panel", "m-auto ml-[1vw] mr-[1vw] p-[1vh_1vw]")}>
				<div className="flex">
					<h1 className="text-2xl text-(--text-color)">Pathfinder Visualizer</h1>
					<AiFillInfoCircle
						className="mx-4 h-10 w-10 shrink-0 cursor-help fill-[greenyellow] hover:fill-green-800"
						onClick={() => { setOpenInfoModal(true); }}
					/>
				</div>

				<Dialog open={openInfoModal} onOpenChange={setOpenInfoModal}>
					<DialogContent aria-describedby="pathfinding-modal-description">
						<DialogTitle>
							Welcome to Pathfinding Visualizer! <TbMoodCrazyHappy className="inline h-8 w-8 align-text-bottom text-[greenyellow]" />
						</DialogTitle>
						<div id="pathfinding-modal-description">
							<div>You can choose wall-building and path-finding algorithms and see them in action!</div>
							<div>Here is a list of options to help you get started:</div>
							<ul className="list-disc space-y-1 pl-5">
								<li>To see the wall creation, please select a wall algorithm from the dropdown and click on the "Build Walls" button. <GiBrickWall className="inline h-8 w-8 align-text-bottom text-[greenyellow]" /></li>
								<li>To see the finding of paths, please select a path algorithm from the dropdown and click on the "Visualize" button. <GiPathDistance className="inline h-8 w-8 align-text-bottom text-[greenyellow]" /></li>
								<li>To reset the start and goal coordinates, click on the "Reset Start/Goal" button. <GiStairsGoal className="inline h-8 w-8 align-text-bottom text-[greenyellow]" /></li>
								<li>To reset the current path visualized, click on the "Reset Path" button. <BiRefresh className="inline h-8 w-8 align-text-bottom text-[greenyellow]" /></li>
								<li>To reset the the board, click on the "Reset All" button. <BiRefresh className="inline h-8 w-8 align-text-bottom text-[greenyellow]" /></li>
							</ul>
						</div>
					</DialogContent>
				</Dialog>

				{/* Ask the user for rows, columns, and algorithms */}
				<form>

					{/* Wall Algorithm type */}
					<label htmlFor="wallAlgorithmChoices" className="text-(--text-color)">Type of Wall Algorithm</label>
					<div className={cn("neu-select", "py-4 text-sm")}>
						<select
							id="wallAlgorithmChoices"
							name="wallAlgorithm"
							aria-label="Wall Algorithm Choices"
							value={wallAlgorithm}
							className="w-full appearance-none bg-inherit p-4 text-sm text-(--text-color) outline-none"
							onChange={handleWallAlgorithmChange}
						>
							<option value="RecursiveDivision">Recursive Division</option>
							<option value="RecursiveDivisionTwoLayers">Twin Recursive Division</option>
						</select>
					</div>
					<div className="mb-4 border-b-[5px] border-dotted border-[greenyellow] pb-4">
						<input className={cn("neu-control", "m-[0.5rem_0.5rem_0.5rem_0] px-4 py-2")} type="button" value="Build Walls" onClick={() => setShouldBuildWalls(true)} />
					</div>

					{/* Path Algorithm type */}
					<label htmlFor="pathAlgorithmChoices" className="pt-4 text-(--text-color)">Type of Path Algorithm</label>
					<div className={cn("neu-select", "py-4 text-sm")}>
						<select
							id="pathAlgorithmChoices"
							name="pathAlgorithm"
							aria-label="Path Algorithm Choices"
							value={pathAlgorithm}
							className="w-full appearance-none bg-inherit p-4 text-sm text-(--text-color) outline-none"
							onChange={handlePathAlgorithmChange}
						>
							<option value="BreadthFirstSearch">Breadth-first Search</option>
							<option value="DepthFirstSearch">Depth-first Search</option>
							<option value="GreedyBestFirstSearch">Greedy Best-First Search</option>
							<option value="DijkstrasAlgorithm">Dijkstra's Algorithm</option>
							<option value="AStarAlgorithm">A* Algorithm</option>
						</select>
					</div>
					<div className="border-b-[5px] border-dotted border-[greenyellow] pb-4">
						<input className={cn("neu-control", "m-[0.5rem_0.5rem_0.5rem_0] px-4 py-2")} type="button" value="Visualize" onClick={() => setShouldVisualizePathAlgorithm(true)}/>
					</div>

					{errorMessage && (
						<div role="alert" className="mt-2 rounded-md bg-red-950/60 px-3 py-2 text-sm text-red-200">
							{errorMessage}
						</div>
					)}

					<div>
						<div className="py-4">
							<input className={cn("neu-control", "m-[0.5rem_0.5rem_0.5rem_0] px-4 py-2")} type="button" value="Reset Start/Goal" onClick={() => {
								setStartCoordinate(randomStartCoordinate(rows, columns));
								setGoalCoordinate(randomGoalCoordinate(rows, columns));
								setErrorMessage(null);
								setShouldResetBoard(true);
							}}/>
							<input className={cn("neu-control", "m-[0.5rem_0.5rem_0.5rem_0] px-4 py-2")} type="button" value="Reset Path" onClick={() => { setErrorMessage(null); setShouldResetPath(true); }}/>
							<input className={cn("neu-control", "m-[0.5rem_0.5rem_0.5rem_0] px-4 py-2")} type="button" value="Reset All" onClick={() => { setErrorMessage(null); setShouldResetBoard(true); }}/>
						</div>
					</div>
				</form>
			</div>

			{/* Board Area */}
			<BoardMemo
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
				onError={setErrorMessage}
			/>
		</div>
	);
}

export default Configuration;
