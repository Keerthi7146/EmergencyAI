import { useState } from 'react';
import { useEmergencyStore, IncidentType, Coordinates } from '../../store/useEmergencyStore';
import { AlertTriangle, HardHat, Car, ShieldBan, RotateCcw } from 'lucide-react';

export function DemoControls() {
  const { 
    journeyState, 
    activeRoute,
    ambulanceTelemetry,
    addIncident,
    clearIncidents,
    addLog
  } = useEmergencyStore();

  const [isOpen, setIsOpen] = useState(true);

  if (journeyState !== 'NAVIGATING' || !activeRoute || !ambulanceTelemetry) {
    return null;
  }

  // Helper to find a point roughly 15% ahead on the remaining path
  const getPointAhead = (): Coordinates => {
    const path = activeRoute.polylineCoords;
    const currentProg = ambulanceTelemetry.progressPercentage / 100;
    const remainingProg = 1 - currentProg;
    
    // Put incident somewhat ahead
    const targetProg = Math.min(0.95, currentProg + remainingProg * 0.2); 
    
    const targetIndex = Math.floor(targetProg * path.length);
    return path[Math.min(targetIndex, path.length - 1)];
  };

  const handleSimulate = (type: IncidentType, severity: 'LOW'|'MEDIUM'|'HIGH', description: string) => {
    const coords = getPointAhead();
    addIncident({ type, coords, severity, description });
  };

  const btnStyle = {
    padding: '10px 16px',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'white',
    fontSize: '13px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s',
  };

  return (
    <div style={{ position: 'absolute', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', zIndex: 9999 }}>
      
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{ ...btnStyle, backgroundColor: '#3b82f6' }}
        >
          <AlertTriangle size={16} /> Show Demo Controls
        </button>
      )}

      {isOpen && (
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', width: '220px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '1px' }}>
              Simulate Incident
            </span>
            <button onClick={() => setIsOpen(false)} style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>&times;</button>
          </div>
          
          <button 
            style={btnStyle}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.9)'}
            onClick={() => handleSimulate('CONSTRUCTION', 'MEDIUM', 'Road Construction')}
          >
            <HardHat size={16} color="#f59e0b" /> Construction
          </button>
          
          <button 
            style={btnStyle}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.9)'}
            onClick={() => handleSimulate('ACCIDENT', 'HIGH', 'Major Collision')}
          >
            <Car size={16} color="#ef4444" /> Accident
          </button>
          
          <button 
            style={btnStyle}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.9)'}
            onClick={() => handleSimulate('CLOSURE', 'HIGH', 'Road Closed')}
          >
            <ShieldBan size={16} color="#ef4444" /> Road Closure
          </button>

          <button 
            style={btnStyle}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.9)'}
            onClick={() => handleSimulate('TRAFFIC_SPIKE', 'MEDIUM', 'Heavy Traffic Detected')}
          >
            <AlertTriangle size={16} color="#3b82f6" /> Traffic Spike
          </button>
          
          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
          
          <button 
            style={{ ...btnStyle, justifyContent: 'center' }}
            onClick={() => {
              clearIncidents();
              addLog('Incidents cleared. AI recalculating nominal route...', 'INFO');
            }}
          >
            <RotateCcw size={16} /> Reset Events
          </button>
        </div>
      )}
    </div>
  );
}
