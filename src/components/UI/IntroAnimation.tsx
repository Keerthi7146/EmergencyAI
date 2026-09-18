import { useEffect, useState } from 'react';
import { useEmergencyStore } from '../../store/useEmergencyStore';
import './IntroAnimation.css';

export function IntroAnimation() {
  const setAppFlowState = useEmergencyStore(state => state.setAppFlowState);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Sequence timing based on the reference diagram
    // 0.0s - 0.5s: Ambulance enters from right
    // 0.5s - 1.5s: Moves & drifts
    // 1.5s - 2.5s: Stops at center
    // 2.5s - 3.5s: Logo appears from behind
    // 3.5s - 4.5s: Logo fixes top center
    // 4.5s - 5.0s: Fade to homepage
    
    const timers = [
      setTimeout(() => setStage(1), 100),   // Start entry immediately
      setTimeout(() => setStage(2), 500),   // Drifting
      setTimeout(() => setStage(3), 1500),  // Stopped at center
      setTimeout(() => setStage(4), 2500),  // Logo emerges
      setTimeout(() => setStage(5), 3500),  // Logo moves top, ambulance fades
      setTimeout(() => setStage(6), 4500),  // Final fade out
      setTimeout(() => setAppFlowState('HOMEPAGE'), 5200) // Unmount
    ];

    return () => timers.forEach(clearTimeout);
  }, [setAppFlowState]);

  return (
    <div className={`intro-cinematic-container stage-${stage}`}>
      {/* Dark background with subtle glow/reflections */}
      <div className="intro-bg"></div>

      {/* Road / Ground reflection */}
      <div className="intro-ground"></div>

      {/* Particles and Smoke */}
      <div className="intro-smoke left-smoke"></div>
      <div className="intro-smoke right-smoke"></div>

      {/* Container for logo (behind ambulance initially) */}
      <div className="intro-logo-container">
        <div className="intro-logo">
          <img src={`${import.meta.env.BASE_URL}emergencyai-logo.png`} alt="EmergencyAI Logo" className="brand-logo-img" style={{ maxWidth: '400px', width: '100%', height: 'auto', objectFit: 'contain' }} />
        </div>
      </div>

      {/* Ambulance */}
      <div className="intro-ambulance-container">
        {/* Siren Lights */}
        <div className="siren-light red-siren"></div>
        <div className="siren-light blue-siren"></div>
        
        {/* Headlights */}
        <div className="headlight left-headlight"></div>
        <div className="headlight right-headlight"></div>
        
        <img src={`${import.meta.env.BASE_URL}tn108_transparent.png`} alt="TN 108 Ambulance" className="intro-ambulance-img" />
      </div>

      {/* Fade out overlay */}
      <div className="intro-fade-overlay"></div>
    </div>
  );
}
