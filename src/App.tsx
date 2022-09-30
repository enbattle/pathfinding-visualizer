import React from 'react';
import Configuration from './components/configurations';
import './App.css';

class App extends React.Component {
  render() {
    return (
      <div id="main" role="main" className="App">
        <Configuration />
      </div>
    );
  }
}

export default App;
