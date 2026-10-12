import React, { useState } from 'react';
import Sessions from './components/Sessions.jsx';
import Heatmap from './components/Heatmap.jsx';

export default function App() {
  const [tab, setTab] = useState('sessions');

  return (
    <div className="app">
      <header className="topbar">
        <h1>User Analytics</h1>
        <nav>
          <button className={tab === 'sessions' ? 'tab active' : 'tab'} onClick={() => setTab('sessions')}>
            Sessions
          </button>
          <button className={tab === 'heatmap' ? 'tab active' : 'tab'} onClick={() => setTab('heatmap')}>
            Heatmap
          </button>
        </nav>
      </header>
      <main>{tab === 'sessions' ? <Sessions /> : <Heatmap />}</main>
    </div>
  );
}
