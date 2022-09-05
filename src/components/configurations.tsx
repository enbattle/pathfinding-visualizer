import React from "react";
import Board from "./board";

interface IConfigurationParameters {
	algorithm: string;
	allowVisualize: boolean;
}

class Configuration extends React.PureComponent<{}, IConfigurationParameters> {
	constructor(props: {}) {
		super(props);

		// Initialize states
		this.state = {
			algorithm: "BreadthFirstSearch",
			allowVisualize: false
		};

		// Initialize important methods
		this.handleChange = this.handleChange.bind(this);
		this.handleSubmit = this.handleSubmit.bind(this);
	}

	// When the input fields change, if the value is invalid, show error message
	handleChange(event: { target: any }) {
		// Remove the grid if user decides to change the grid layout again
		this.setState({allowVisualize: false});

		if (event.target.name === "algorithm") {
			this.setState({algorithm: event.target.value});
		}
	}

	// When user submits input fields, check for validity, and then move on to the next step (allow users to pick walls)
	handleSubmit(event: { preventDefault: () => void; }) {
		event.preventDefault();

		// Rows, columns, and algorithm obtained --- time to show the grid
		this.setState({allowVisualize: true});
	}

	render() {
		return (
			<div className="container">

				{/* Menu Area */}
				<div className="menu">
					<h3>Pathfinder Visualizer</h3>
					
					{/* Ask the user for rows, columns, and algorithm */}
					<form onSubmit={this.handleSubmit}>
						
						{/* Algorithm type */}
						<label htmlFor="algorithmChoices" >Type of Algorithm</label>
						<div>
							<select 
								id="algorithmChoices"
								name="algorithm"
								aria-label="Algorithm Choices"
								value={this.state.algorithm}
								onChange={this.handleChange}
							>
								<option value="BreadthFirstSearch">Breadth-first Search</option>
								<option value="DepthFirstSearch">Depth-first Search</option>
								<option value="UniformCostSearch">Uniform-Cost Search</option>
								<option value="AStarAlgorithm">A* Algorithm</option>
							</select>
						</div>

						<div>
							<input type="submit" value="Submit"/>
						</div>
					</form>
				</div>

				{/* Board Area */}
				<Board rows={15} columns={15} algorithm={this.state.algorithm} allowVisualize={this.state.allowVisualize}/>
			</div>
		);
	}
}

export default Configuration;