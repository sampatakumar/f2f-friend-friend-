import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import HostView from './ui/HostView';
import ControllerView from './ui/ControllerView';

function App() {
  const { connect } = useAppStore();

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <BrowserRouter>
      <div className="w-full h-full bg-slate-900 text-slate-50 overflow-hidden font-sans">
        <Routes>
          <Route path="/" element={<HostView />} />
          <Route path="/controller/:roomId" element={<ControllerView />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
