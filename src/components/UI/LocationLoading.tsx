
import './LocationLoading.css';

export function LocationLoading() {
  return (
    <div className="location-loading-overlay">
      <div className="location-loading-box">
        <div className="location-loading-header" style={{ display: 'flex', justifyContent: 'center' }}>
          <img src="/emergencyai-logo.png" alt="EmergencyAI Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
        </div>
        
        <h3 className="location-loading-title">VERIFYING LOCATION</h3>
        
        <div className="location-loading-track">
          <img src="/tn108.jpg" alt="Ambulance" className="location-loading-ambulance" />
          <div className="location-loading-scan"></div>
        </div>
        
        <div className="location-loading-text">
          <div className="loading-step active">Searching nearby locations...</div>
          <div className="loading-step delay-1">Finding the best match...</div>
          <div className="loading-step delay-2">Almost there...</div>
        </div>
      </div>
    </div>
  );
}
