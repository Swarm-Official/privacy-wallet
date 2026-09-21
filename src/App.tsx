import logo from "./assets/img/swarm-mark.png";
import "./App.css";
import APP_VERSION from "./version";
import { SWARM_APP_NAME } from "./utils/swarmNetwork";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <p>Built using CRA electron-builder-typescript Template.</p>
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          {SWARM_APP_NAME} v{APP_VERSION}
        </p>
        <p>
          Edit <code>public/electron.js</code> or <code>src/App.js</code> and save to reload.
        </p>
      </header>
    </div>
  );
}

export default App;
