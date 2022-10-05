import React from 'react';
import Configuration from './components/configurations';
import './App.css';

class App extends React.Component {
  render() {
    return (
      <main id="main" role="main" className="App">
        <Configuration />
      </main>
    );
  }
}

export default App;
