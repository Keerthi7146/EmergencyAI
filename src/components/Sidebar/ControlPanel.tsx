import { useEmergencyStore } from '../../store/useEmergencyStore';
import { Ambulance, MapPin, Navigation, Activity, ShieldAlert, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';

export function ControlPanel() {
  const { 
    startLocation, 
    destination, 
    journeyState, 
    activeRoute,
    alternativeRoutes,
    ambulanceTelemetry,
    eventLog,
    startEmergency,
    setAppFlowState,
    resetJourney
  } = useEmergencyStore();

  const [logExpanded, setLogExpanded] = useState(false);

  const handleStartEmergency = () => {
    if (activeRoute) {
      startEmergency(activeRoute);
    }
  };

  const handleCancel = () => {
    resetJourney();
    setAppFlowState('HOMEPAGE');
  };

  const maneuverText = ambulanceTelemetry?.nextManeuver || 'Continue straight';
  const getManeuverDir = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('left')) return 'left';
    if (lower.includes('right')) return 'right';
    if (lower.includes('u-turn')) return 'left';
    return 'up';
  };
  const maneuverDir = getManeuverDir(maneuverText);

  return (
    <div className="text-white w-full max-w-sm h-full flex flex-col pointer-events-none" style={{ 
      position: 'absolute', left: '20px', top: '20px', bottom: '20px', zIndex: 9999 
    }}>
      
      {/* Route Selection State */}
      {journeyState === 'SETUP' && (
        <div className="glass-panel pointer-events-auto" style={{ 
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert color="#ef4444" size={20} /> ROUTE OPTIONS
            </h1>
            <button onClick={handleCancel} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            {/* Summary */}
            <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                <div style={{ color: '#94a3b8', marginTop: '2px' }}><Ambulance size={16} /></div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Origin</div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{startLocation?.name || startLocation?.address.split(',')[0]}</div>
                </div>
              </div>
              <div style={{ width: '2px', height: '16px', background: 'rgba(255,255,255,0.1)', marginLeft: '6px', marginTop: '-12px', marginBottom: '4px' }}></div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ color: '#ef4444', marginTop: '2px' }}><MapPin size={16} /></div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destination</div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#fca5a5' }}>{destination?.name || destination?.address.split(',')[0]}</div>
                </div>
              </div>
            </div>

            {/* Routes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {alternativeRoutes.filter(r => r && r.id).map(route => {
                const isSelected = activeRoute?.id === route.id;
                
                let labelColor = '#10b981';
                let labelIcon = '🟢';
                let bgActive = 'rgba(16, 185, 129, 0.1)';
                if (route.recommendationLabel === 'ALTERNATIVE') { labelColor = '#f59e0b'; labelIcon = '🟠'; bgActive = 'rgba(245, 158, 11, 0.1)'; }
                if (route.recommendationLabel === 'HIGH RISK') { labelColor = '#ef4444'; labelIcon = '🔴'; bgActive = 'rgba(239, 68, 68, 0.1)'; }

                return (
                  <div 
                    key={route.id}
                    onClick={() => useEmergencyStore.getState().setActiveRoute(route)}
                    style={{
                      padding: '16px',
                      background: isSelected ? bgActive : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${isSelected ? labelColor : 'rgba(255,255,255,0.05)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontWeight: 700, color: labelColor, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {labelIcon} {route.recommendationLabel || 'ROUTE'}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>{route.distanceText || ''}</div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1 }}>{route.durationText || ''}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', fontWeight: 500 }}>
                          Traffic: <span style={{ color: '#cbd5e1' }}>{route.trafficStatus || 'UNKNOWN'}</span> • Risk: <span style={{ color: '#cbd5e1' }}>{route.riskScore || 'UNKNOWN'}</span>
                        </div>
                      </div>
                    </div>

                    {isSelected && route.recommendationReason && (
                      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${labelColor}40`, fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                        {route.recommendationReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button 
              onClick={handleStartEmergency}
              disabled={!activeRoute}
              style={{
                width: '100%',
                padding: '18px',
                backgroundColor: activeRoute ? '#10b981' : '#334155',
                color: 'white',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '15px',
                letterSpacing: '0.05em',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                border: 'none',
                cursor: activeRoute ? 'pointer' : 'not-allowed',
                boxShadow: activeRoute ? '0 10px 15px -3px rgba(16, 185, 129, 0.3)' : 'none'
              }}
            >
              <Navigation size={20} /> START EMERGENCY ROUTE
            </button>
          </div>
        </div>
      )}

      {/* Navigating State - COMMAND CENTER */}
      {journeyState === 'NAVIGATING' && ambulanceTelemetry && (
        <div className="flex flex-col gap-4 pointer-events-none h-full">
          
          {/* Main Maneuver Panel */}
          <div className="pointer-events-auto" style={{ 
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            
            {/* Next Maneuver */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '12px', 
                background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '32px', color: 'white', border: '1px solid rgba(255,255,255,0.05)'
              }}>
                {maneuverDir === 'up' ? '↑' : maneuverDir === 'left' ? '←' : '→'}
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1.2, color: 'white' }}>
                  {maneuverText}
                </div>
              </div>
            </div>

            {/* Critical Telemetry */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Distance
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: 'white', lineHeight: 1 }}>
                  {ambulanceTelemetry.distanceRemainingText}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  ETA
                </div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>
                  {ambulanceTelemetry.timeRemainingText}
                </div>
              </div>
            </div>
            
          </div>

          {/* Secondary Telemetry Panel */}
          <div className="pointer-events-auto" style={{ 
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Speed</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>{ambulanceTelemetry.speedKmH} <span style={{ fontSize: '12px', color: '#94a3b8' }}>km/h</span></div>
            </div>
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }}></div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Progress</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>{ambulanceTelemetry.progressPercentage}%</div>
            </div>
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }}></div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>AI Status</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>ACTIVE</div>
            </div>
          </div>

          {/* Event Log Toggle (Minimal) */}
          <div className="pointer-events-auto mt-auto">
            <button 
              onClick={() => setLogExpanded(!logExpanded)}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: logExpanded ? '12px 12px 0 0' : '12px',
                padding: '12px 16px',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={16} /> SYSTEM LOG</div>
              <ChevronRight size={16} style={{ transform: logExpanded ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
            
            {logExpanded && (
              <div style={{ 
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderTop: 'none',
                borderRadius: '0 0 12px 12px',
                padding: '16px',
                maxHeight: '200px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {eventLog.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <div style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                      {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div style={{ 
                      color: log.type === 'SUCCESS' ? '#10b981' : 
                             log.type === 'WARNING' ? '#f59e0b' : 
                             log.type === 'CRITICAL' ? '#ef4444' : '#e2e8f0',
                      fontWeight: 500
                    }}>
                      {log.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      )}

      {/* Arrived State */}
      {journeyState === 'ARRIVED' && (
        <div className="glass-panel pointer-events-auto" style={{ 
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <CheckCircle2 size={64} color="#10b981" style={{ marginBottom: '24px' }} />
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', color: 'white' }}>ARRIVED</h2>
          <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: '32px', fontSize: '15px' }}>
            Ambulance has reached<br/><strong style={{ color: 'white' }}>{destination?.name || 'the destination'}</strong>.
          </p>
          <button 
            onClick={handleCancel}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#334155',
              color: 'white',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '15px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#475569'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#334155'}
          >
            END MISSION
          </button>
        </div>
      )}

    </div>
  );
}
