import { useEffect } from 'react';
import { useGameState } from '../systems';
import './LandingScreen.css';

interface LandingScreenProps {
  onEnter: () => void;
}

export default function LandingScreen({ onEnter }: LandingScreenProps) {
  const character = useGameState((state) => state.character);

  // If character already exists, skip landing screen
  useEffect(() => {
    if (character) {
      onEnter();
    }
  }, [character, onEnter]);

  const handleEnter = () => {
    onEnter();
  };

  return (
    <div className="landing-screen">
      <div className="landing-content">
        <div className="game-title">
          <h1 className="title-main">Tales of Heroes,</h1>
          <h1 className="title-main">Legends & Beasts</h1>
          <p className="title-subtitle">An Idle RPG Adventure</p>
        </div>
        
        <div className="landing-description">
          <p>Embark on an epic journey where heroes rise, legends are forged, and beasts await your challenge.</p>
          <p>Progress through dungeons, master skills, and build your legacy—even while you're away.</p>
        </div>

        <button className="enter-button" onClick={handleEnter}>
          Begin Your Journey
        </button>
      </div>
    </div>
  );
}

