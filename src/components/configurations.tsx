import React from "react";
import BoardMemo, { type RunStats } from "./board";
import { randIntBetween } from '../util/function-util';
import type { CoordinateAndDirection } from "../models/models";
import { AiFillInfoCircle } from 'react-icons/ai';
import { TbMoodCrazyHappy } from 'react-icons/tb';
import { GiBrickWall, GiPathDistance, GiStairsGoal } from 'react-icons/gi';
import { BiRefresh } from 'react-icons/bi';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Computes the board size (rows/columns) from the current viewport.
// 28px matches board-cell's fixed size in index.css (1.75rem, border-box) -
// keep these in sync so the computed grid actually fills the viewport
// instead of leaving a gap or overflowing.
const CELL_SIZE_PX = 28;

function computeBoardSize(): { rows: number; columns: number } {
	const rows = Math.floor(window.innerHeight / CELL_SIZE_PX) >= 20 ? Math.floor(window.innerHeight / CELL_SIZE_PX) : 20;
	const columns = Math.floor(window.innerWidth / CELL_SIZE_PX) >= 20 ? Math.floor(window.innerWidth / CELL_SIZE_PX) : 20;
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

// Higher slider value = faster animation, so the step delay it maps to
// (what the algorithms actually use) runs the other way: a bigger slider
// value means a smaller delay-per-step.
const MIN_STEP_DELAY = 2;
const MAX_STEP_DELAY = 40;
const DEFAULT_SPEED = 80; // 0-100 slider position; 80 maps close to the original hardcoded 10ms step

function speedToStepDelay(speed: number): number {
	const t = 1 - speed / 100;
	return Math.round(MIN_STEP_DELAY + t * (MAX_STEP_DELAY - MIN_STEP_DELAY));
}

const LEGEND_ITEMS: { label: string; swatchClassName: string }[] = [
	{ label: "Start / Goal", swatchClassName: "legend-swatch-anchor" },
	{ label: "Wall", swatchClassName: "legend-swatch-wall" },
	{ label: "Weighted terrain", swatchClassName: "legend-swatch-weight" },
	{ label: "Visited", swatchClassName: "legend-swatch-visited" },
	{ label: "Path", swatchClassName: "legend-swatch-path" },
];

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
	const [paintMode, setPaintMode] = React.useState<"wall" | "weight">("wall");
	const [speed, setSpeed] = React.useState<number>(DEFAULT_SPEED);
	const [shouldBuildWalls, setShouldBuildWalls] = React.useState<boolean>(false);
	const [shouldVisualizePathAlgorithm, setShouldVisualizePathAlgorithm] = React.useState<boolean>(false);
	const [shouldResetBoard, setShouldResetBoard] = React.useState<boolean>(false);
	const [shouldResetPath, setShouldResetPath] = React.useState<boolean>(false);

	// Info Modal state
	const [openInfoModal, setOpenInfoModal] = React.useState<boolean>(false);

	// Algorithm-run error state (e.g. no path found)
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

	// Live run stats (nodes visited, path length, algorithm time)
	const [stats, setStats] = React.useState<RunStats | null>(null);

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

	const stepDelay = speedToStepDelay(speed);

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
								<li>Drag the Start or Goal marker to move it anywhere on the board.</li>
								<li>Click, or click-and-drag, an empty cell to paint a wall or weighted terrain, depending on the paint mode selected below the wall algorithm.</li>
							</ul>
						</div>
					</DialogContent>
				</Dialog>

				{/* Legend */}
				<div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--text-color)" aria-label="Cell color legend">
					{LEGEND_ITEMS.map((item) => (
						<div key={item.label} className="flex items-center gap-1">
							<span className={cn("legend-swatch", item.swatchClassName)} aria-hidden="true" />
							{item.label}
						</div>
					))}
				</div>

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
							<option value="Prims">Prim's Algorithm</option>
						</select>
					</div>
					<div className="mb-4 flex flex-wrap items-center gap-2 border-b-[5px] border-dotted border-[greenyellow] pb-4">
						<input className={cn("neu-control", "m-[0.5rem_0.5rem_0.5rem_0] px-4 py-2")} type="button" value="Build Walls" onClick={() => setShouldBuildWalls(true)} />

						<div className={cn("neu-select", "py-2 text-sm")} role="group" aria-label="Paint mode">
							<select
								id="paintModeChoice"
								name="paintMode"
								aria-label="Paint Mode Choices"
								value={paintMode}
								className="w-full appearance-none bg-inherit p-2 text-sm text-(--text-color) outline-none"
								onChange={(event) => setPaintMode(event.target.value === "weight" ? "weight" : "wall")}
							>
								<option value="wall">Paint: Wall</option>
								<option value="weight">Paint: Weighted Terrain</option>
							</select>
						</div>
					</div>

					{/* Speed control */}
					<label htmlFor="speedControl" className="text-(--text-color)">Animation Speed</label>
					<div className="mb-4 border-b-[5px] border-dotted border-[greenyellow] pb-4">
						<input
							id="speedControl"
							type="range"
							min={0}
							max={100}
							value={speed}
							aria-label="Animation speed"
							className="w-full"
							onChange={(event) => setSpeed(Number(event.target.value))}
						/>
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

					{stats && (
						<div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-(--text-color)" role="status">
							<div>
								<div className="font-bold">{stats.visitedCount}</div>
								<div>Nodes visited</div>
							</div>
							<div>
								<div className="font-bold">{stats.pathLength ?? "—"}</div>
								<div>Path length</div>
							</div>
							<div>
								<div className="font-bold">{stats.algorithmTimeMs >= 0 ? `${stats.algorithmTimeMs.toFixed(2)}ms` : "…"}</div>
								<div>Algorithm time</div>
							</div>
						</div>
					)}

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
								setStats(null);
								setShouldResetBoard(true);
							}}/>
							<input className={cn("neu-control", "m-[0.5rem_0.5rem_0.5rem_0] px-4 py-2")} type="button" value="Reset Path" onClick={() => { setErrorMessage(null); setStats(null); setShouldResetPath(true); }}/>
							<input className={cn("neu-control", "m-[0.5rem_0.5rem_0.5rem_0] px-4 py-2")} type="button" value="Reset All" onClick={() => { setErrorMessage(null); setStats(null); setShouldResetBoard(true); }}/>
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
				paintMode={paintMode}
				stepDelay={stepDelay}
				shouldBuildWalls={shouldBuildWalls}
				setShouldBuildWalls={setShouldBuildWalls}
				shouldVisualizePathAlgorithm={shouldVisualizePathAlgorithm}
				setShouldVisualizePathAlgorithm={setShouldVisualizePathAlgorithm}
				shouldResetBoard={shouldResetBoard}
				setShouldResetBoard={setShouldResetBoard}
				shouldResetPath={shouldResetPath}
				setShouldResetPath={setShouldResetPath}
				onError={setErrorMessage}
				onStats={setStats}
			/>
		</div>
	);
}

export default Configuration;
