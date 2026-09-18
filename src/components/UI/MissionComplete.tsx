import { useEmergencyStore } from '../../store/useEmergencyStore';
import { CheckCircle, RotateCcw, Home } from 'lucide-react';
import './MissionComplete.css';

export function MissionComplete() {
  const { activeRoute, resetJourney } = useEmergencyStore();

  const handleBackToHome = () => {
    resetJourney();
  };

  return (
    <div className="mission-complete-overlay">
      <div className="mission-complete-card">
        <div className="mc-header" style={{ display: 'flex', justifyContent: 'center' }}>
          <img src="/emergencyai-logo.png" alt="EmergencyAI Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
        </div>

        <div className="mc-success-icon">
          <CheckCircle size={48} className="text-green-500" />
        </div>
        
        <h2 className="mc-title">REACHED THE HOSPITAL</h2>
        <p className="mc-subtitle">Every second counts. You made it.</p>

        <div className="mc-ambulance-wrapper">
          <img src="/tn108_transparent.png" alt="Ambulance" className="mc-ambulance" />
        </div>

        <div className="mc-summary">
          <div className="mc-stat">
            <span className="mc-stat-label">TOTAL DISTANCE</span>
            <span className="mc-stat-value">{activeRoute?.distanceText || '0 km'}</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">TOTAL TIME</span>
            <span className="mc-stat-value">{activeRoute?.durationText || '0 min'}</span>
          </div>
          <div className="mc-stat">
            <span className="mc-stat-label">ROUTE STATUS</span>
            <span className="mc-stat-value text-green-400">Completed</span>
          </div>
        </div>

        <div className="mc-actions">
          <button className="mc-btn-primary" onClick={handleBackToHome}>
            <Home size={18} /> BACK TO HOME
          </button>
          <button className="mc-btn-secondary" onClick={() => window.location.reload()}>
            <RotateCcw size={18} /> RESET SIMULATION
          </button>
        </div>
      </div>
    </div>
  );
}
