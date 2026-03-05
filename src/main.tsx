import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import App from './App.tsx';
import { registerGame } from './engine/GamePlugin';
import { Racing3D } from './games/racing3d';

registerGame(Racing3D);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
