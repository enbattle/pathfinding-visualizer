import React from 'react';
import { breadthAndDepthFirstSearch, uniformCostSearch, aStarAlgorithmSearch } from '../util/algorithm-util';

interface CoordinateAndDirection {
	row: number;
	column: number;
	direction: string;
}

interface IBoardParameters {
	rows: number;
	columns: number;
	algorithm: string;
	allowVisualize: boolean;
}

interface IBoardState {
	start: CoordinateAndDirection;
	goal: CoordinateAndDirection;
	walls: Set<string>;
	noPath: string;
	ranAlgorithm: boolean;
	showEndPath: boolean;
}

class Board extends React.PureComponent<IBoardParameters, IBoardState> {
	constructor(props: IBoardParameters) {
		super(props);

		// Set of walls that the user wishes to put into place
		let bigWalls = new Set<string>();

		// Set static coordinates of start and goal coordinates
		let startRow = Math.floor(Math.random() * this.props.rows);
		let startColumn = Math.floor(Math.random() * this.props.columns);
		let goalRow = Math.floor(Math.random() * this.props.rows)
		let goalColumn = Math.floor(Math.random() * this.props.columns)

		// Initialize the start state and the goal state
		let startState: CoordinateAndDirection = {
			row: startRow,
			column: startColumn,
			direction: ""
		};
		
		let goalState: CoordinateAndDirection = {
			row: goalRow,
			column: goalColumn,
			direction: ""
		};

		// Initialize States
		this.state = {
			start: startState,
			goal: goalState,
			walls: bigWalls,
			noPath: "",
			ranAlgorithm: false,
			showEndPath: false
		};

		// Initialize important methods
		this.addWall = this.addWall.bind(this);
		this.handleRun = this.handleRun.bind(this);
		this.handleReset = this.handleReset.bind(this);
		this.resetBoard = this.resetBoard.bind(this);
		this.setShowEndPath = this.setShowEndPath.bind(this);
	}

	componentDidUpdate(prevProps: Readonly<IBoardParameters>, prevState: Readonly<IBoardState>, snapshot?: any): void {
		if(prevProps.algorithm !== this.props.algorithm) {
			this.resetBoard();
		}
	}

	// Add a wall to the board
	// If algorithm has already been run, you can't interact with the board again
	addWall(event: { target: any; }) {
		if (!this.state.ranAlgorithm) {
			let addingWall: boolean;

			// Show that the user clicked on a wall
			if (document?.getElementById(event.target.id)?.className.includes("wall-fill")) {
				document!.getElementById(event.target.id)!.className = "columns regular board-padding";
				addingWall = false;
			}
			else {
				document!.getElementById(event.target.id)!.className += " wall-fill";
				addingWall = true;
			}

			// ID of each grid box is in the form "row_column"
			let gridIndices = event.target.id.split("_");

			// Update the board so that a box has become a wall
			let moreWalls = this.state.walls;
			
			let newWall = gridIndices[0].toString() + "_" + gridIndices[1].toString();
			if (addingWall) {
				// Add wall to the set
				moreWalls.add(newWall);
			}
			else {
				// Remove wall from the set
				moreWalls.delete(newWall);
			}

			// Update Set of walls
			this.setState({walls: moreWalls});
		}
	}

	setShowEndPath(showPath: boolean) {
		this.setState({showEndPath: showPath});
	}

	// Run the path finding algorithm
	// If algorithm has already been run, you can't run the board again
	handleRun(event: { preventDefault: () => void; }) {
		event.preventDefault();

		let path = null;
		if (!this.state.ranAlgorithm) {
			if (this.props.algorithm === "BreadthFirstSearch") {
				path = breadthAndDepthFirstSearch(this.props.rows, this.props.columns, this.state.start, this.state.goal, this.state.walls, "BreadthFirstSearch", this.setShowEndPath);
			}
			else if (this.props.algorithm === "DepthFirstSearch") {
				path = breadthAndDepthFirstSearch(this.props.rows, this.props.columns, this.state.start, this.state.goal, this.state.walls, "DepthFirstSearch", this.setShowEndPath);
			}
			else if (this.props.algorithm === "UniformCostSearch") {
				path = uniformCostSearch(this.props.rows, this.props.columns, this.state.start, this.state.goal, this.state.walls, this.setShowEndPath);
			}
			else if (this.props.algorithm === "AStarAlgorithm") {
				path = aStarAlgorithmSearch(this.props.rows, this.props.columns, this.state.start, this.state.goal, this.state.walls, this.setShowEndPath);
			}

			if (path === null) {
				this.setState({noPath: "Could not find a path."});
			}

			this.setState({ranAlgorithm: true});
		}
	}

	// Reset the board
	handleReset(event: { preventDefault: () => void; }) {
		event.preventDefault();
		this.resetBoard();
	}

	resetBoard() {
		this.setState({walls: new Set(), noPath: "", showEndPath: false});

		let board = document.getElementsByClassName("columns") as HTMLCollectionOf<HTMLElement>;
		for (let i=0; i<board.length; i++) {
			if (board[i].className.includes("start")) {
				board[i].className = "columns start text-center";
			}
			else if (board[i].className.includes("goal")) {
				board[i].className = "columns goal text-center";
			}
			else {
				board[i].className = "columns regular board-padding";
				board[i].style.backgroundColor = "white";
			}
		}

		this.setState({ranAlgorithm: false});
	}
	
	render() {
		// Create a grid for the user to choose walls for
		const field: JSX.Element[] = [];
		
		// Check if no path can be found
		const noPath = this.state.noPath;

		// Create board
		for (let i=0; i<this.props.rows; i++) {
			let cells: JSX.Element[] = [];
			for (let j=0; j<this.props.columns; j++) {
				if(i === this.state.start.row && j === this.state.start.column) { // Start
					cells.push(<td key={j} id={i.toString() + "_" + j.toString()} className="columns start text-center">S</td>)
				}
				else if (i === this.state.goal.row && j === this.state.goal.column) { // Goal
					cells.push(<td key={j} id={i.toString() + "_" + j.toString()} className="columns goal text-center">G</td>);
				}
				else { // All other cells
					cells.push(
						<td 
							key={j}
							id={i.toString() + "_" + j.toString()}
							className="columns board-padding"
							onClick={this.addWall}
						></td>
					);
				}
			}
			field.push(<tr key={i}>{cells}</tr>);
		}

		return (
			<div>
				<div>
					{/* Board area */}
					<table>
						<tbody>
							{field}
						</tbody>
					</table>

					{/* Visualize or reset the board */}
					<div>
						{ this.props.allowVisualize	 &&
							<form onSubmit={this.handleRun}>
								<input type="submit" value="Visualize"/>
							</form>
						}
							<form onSubmit={this.handleReset}>
								<input type="submit" value="Reset"/>
							</form>
					</div>

					{/* Show error message for no paths */}
					{noPath && <div className="no-path">{noPath}</div>}
				</div>
			</div>
		);
	}
}

export default Board;