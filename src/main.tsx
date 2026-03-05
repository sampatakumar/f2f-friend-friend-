import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import App from './App.tsx';
import { SpaceArena } from './games/spaceArena';
import { Racing3D } from './games/racing3d';
import { TankBattle } from './games/tankBattle';
import { Invaders } from './games/invaders';
import { registerGame } from './engine/GamePlugin';

// Register all games
registerGame(SpaceArena);
registerGame(Racing3D);
registerGame(TankBattle);
registerGame(Invaders);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
