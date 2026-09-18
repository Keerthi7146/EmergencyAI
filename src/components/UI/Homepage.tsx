import { useEmergencyStore } from '../../store/useEmergencyStore';
import { LocationSearch } from '../Search/LocationSearch';
import { ShieldAlert, MapPin, Zap, ShieldCheck, Building2, Timer, Phone, Crosshair, Search, ArrowRight } from 'lucide-react';
import './Homepage.css';

export function Homepage() {
  const { 
    startLocation, 
    destination, 
    setStartLocation, 
    setDestination, 
    calculateRoutes,
    routeError,
    appFlowState
  } = useEmergencyStore();

  const handleCalculate = () => {
    calculateRoutes();
  };

  return (
    <div className="homepage-container">
      {/* Background Image Layer */}
      <div className="homepage-background" style={{ backgroundImage: 'url(/hero-bg.jpg)' }}>
        <div className="homepage-bg-gradient"></div>
      </div>

      <div className="homepage-content-layer">
        {/* Header */}
        <header className="homepage-header">
          <div className="brand-group">
            <img src="/emergencyai-logo.png" alt="EmergencyAI Logo" style={{ height: '56px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <nav className="homepage-nav">
            <a href="#" className="active-nav">Home</a>
            <a href="#">Navigation</a>
            <a href="#">Command Center</a>
            <a href="#">About</a>
            <a href="#">Support</a>
          </nav>
          <button className="emergency-mode-btn">
            <Phone size={18} fill="currentColor" />
            Emergency Mode
          </button>
        </header>

        {/* Main Content */}
        <main className="homepage-main">
          {/* Left Column: Inputs */}
          <div className="homepage-left">
            <div className="badge">
              FASTER ROUTES. <span className="badge-highlight">SAFER LIVES.</span>
            </div>
            
            <h1 className="hero-headline">
              Emergency navigation,<br />
              <span className="text-accent">built for every second.</span>
            </h1>
            <p className="hero-subtext">
              Get the fastest and safest route to emergency care with the power of AI.
            </p>

            <div className="input-card">
              <div className="input-group">
                <label className="input-label">
                  <MapPin size={16} color="#ef4444" />
                  PICKUP LOCATION
                </label>
                <div className="input-wrapper">
                  <LocationSearch 
                    placeholder="Enter pickup location" 
                    onPlaceSelected={setStartLocation}
                    className="custom-search-input"
                  />
                  <Crosshair className="input-icon-right" size={20} />
                </div>
                {startLocation && (
                  <div className="selected-location text-green-400 mt-1 text-sm">
                    ✓ {startLocation.name || startLocation.address.split(',')[0]}
                  </div>
                )}
              </div>

              <div className="input-group" style={{ marginTop: '24px' }}>
                <label className="input-label">
                  <Building2 size={16} color="#ef4444" />
                  DESTINATION HOSPITAL
                </label>
                <div className="input-wrapper">
                  <LocationSearch 
                    placeholder="Search destination hospital" 
                    onPlaceSelected={setDestination}
                    filterType="hospital"
                    className="custom-search-input"
                  />
                  <Search className="input-icon-right" size={20} />
                </div>
                {destination && (
                  <div className="selected-location text-green-400 mt-1 text-sm">
                    ✓ {destination.name || destination.address.split(',')[0]}
                  </div>
                )}
              </div>

              {routeError && (
                <div className="error-message">
                  <ShieldAlert size={16} /> {routeError}
                </div>
              )}

              <button 
                className={`primary-button ${startLocation && destination && appFlowState !== 'CALCULATING' ? 'active' : 'disabled'}`}
                onClick={handleCalculate}
                disabled={!startLocation || !destination || appFlowState === 'CALCULATING'}
              >
                <ArrowRight size={20} /> FIND EMERGENCY ROUTE
              </button>

              <div className="input-card-footer">
                AI-powered routing &nbsp;|&nbsp; Real-time road insights &nbsp;|&nbsp; Chennai & nearby regions
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Bottom Feature Strip */}
      <footer className="homepage-footer">
        <div className="feature-item">
          <div className="feature-icon-wrapper">
            <Zap className="feature-icon" size={24} />
          </div>
          <div>
            <h4>AI Optimized Routes</h4>
            <p>Find the fastest and safest route</p>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon-wrapper">
            <ShieldCheck className="feature-icon" size={24} />
          </div>
          <div>
            <h4>Incident Awareness</h4>
            <p>Avoid traffic, construction and risks</p>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon-wrapper">
            <Building2 className="feature-icon" size={24} />
          </div>
          <div>
            <h4>Verified Hospitals</h4>
            <p>Access accurate hospital information</p>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon-wrapper">
            <Timer className="feature-icon" size={24} />
          </div>
          <div>
            <h4>Built for Real Emergencies</h4>
            <p>Because every second counts</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
