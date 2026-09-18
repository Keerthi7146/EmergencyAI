import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEmergencyStore } from '../../store/useEmergencyStore';

import hospitalsData from '../../data/hospitals.json';

// Helper component to center map and recalculate route
function MapController() {
  const map = useMap();
  const { 
    startLocation, 
    alternativeRoutes,
    journeyState,
    ambulanceTelemetry
  } = useEmergencyStore();

  // Recalculate routes on change is now handled exclusively by Homepage and UI buttons, 
  // preventing infinite unmount/mount loops with appFlowState.

  // Handle auto-fit bounds during SETUP when routes are received
  useEffect(() => {
    if (journeyState === 'SETUP' && alternativeRoutes.length > 0) {
      const validRoutes = alternativeRoutes.filter(r => r && Array.isArray(r.polylineCoords));
      const allCoords = validRoutes.flatMap(r => r.polylineCoords.map(c => [c.lat, c.lng] as [number, number]));
      
      if (allCoords.length > 0) {
        try {
          const bounds = L.latLngBounds(allCoords);
          map.fitBounds(bounds, { padding: [50, 50] });
        } catch (e) {
          console.error("Leaflet fitBounds error:", e);
        }
      }
    }
  }, [journeyState, alternativeRoutes, map]);

  // Handle pan when SETUP has a start location but no routes yet
  useEffect(() => {
    if (journeyState === 'SETUP' && startLocation && alternativeRoutes.length === 0) {
      map.setView([startLocation.coords.lat, startLocation.coords.lng], 14);
    }
  }, [journeyState, startLocation, map]);

  // Auto pan ONCE when starting navigation
  useEffect(() => {
    if (journeyState === 'NAVIGATING' && ambulanceTelemetry) {
      map.setView([ambulanceTelemetry.currentCoords.lat, ambulanceTelemetry.currentCoords.lng], 15);
    }
    // EXPLICITLY ignore ambulanceTelemetry updates so it only fires when journeyState changes to NAVIGATING
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyState, map]);

  return null;
}

// Custom DivIcons to replace Google's AdvancedMarkers
const createIcon = (emoji: string, bgColor: string, borderColor: string, rotation: number = 0) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 30px; height: 30px; background: ${bgColor}; 
      border-radius: 50%; display: flex; align-items: center; 
      justify-content: center; border: 2px solid ${borderColor};
      font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      transform: translate(-50%, -50%) rotate(${rotation}deg);
    ">${emoji}</div>`,
    iconSize: [0, 0], // The offset is handled by the div itself
  });
};

// Even smaller, subtle icon for background hospitals
const subtleHospitalIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 20px; height: 20px; background: rgba(30, 41, 59, 0.7); 
    border-radius: 50%; display: flex; align-items: center; 
    justify-content: center; border: 1px solid rgba(255,255,255,0.2);
    font-size: 10px;
    transform: translate(-50%, -50%);
  ">🏥</div>`,
  iconSize: [0, 0],
});

const startIcon = createIcon('📍', '#0f172a', '#ffffff');
const destIcon = createIcon('🏥', '#ef4444', '#7f1d1d');

const getAmbulanceIcon = (bearing: number = 0) => {
  return L.divIcon({
    className: 'ambulance-marker',
    html: `<img src="/tn108_transparent.png" style="width: 40px; height: 40px; object-fit: contain; transform: translate(-50%, -50%) rotate(${bearing}deg); transition: transform 0.2s ease-in-out;" />`,
    iconSize: [0, 0],
  });
};

const getIncidentIcon = (type: string) => {
  const emoji = type === 'CONSTRUCTION' ? '🚧' : 
                type === 'ACCIDENT' ? '💥' : 
                type === 'CLOSURE' ? '⛔' : '🚦';
  return createIcon(emoji, '#f59e0b', '#ffffff');
};

export function LeafletMapWrapper() {
  const { 
    startLocation, 
    destination, 
    activeRoute,
    alternativeRoutes, 
    ambulanceTelemetry, 
    incidents,
    journeyState
  } = useEmergencyStore();

  const defaultCenter: [number, number] = [13.0827, 80.2707]; // Chennai
  const maxBounds: L.LatLngBoundsLiteral = [
    [12.2, 79.2], // South West
    [13.6, 80.4]  // North East
  ];

  // Sort routes by priority so highest priority renders last (on top of SVG stack)
  // High Risk (Red) -> Alternative (Orange) -> Recommended (Green)
  const getRouteSortScore = (label?: string) => {
    if (label === 'HIGH RISK') return 1;
    if (label === 'ALTERNATIVE') return 2;
    if (label === 'AI RECOMMENDED') return 3;
    return 0;
  };
  
  const sortedRoutes = [...alternativeRoutes].sort((a, b) => {
    // If one is selected, it should be rendered last (highest z-index in SVG)
    if (activeRoute?.id === a?.id) return 1;
    if (activeRoute?.id === b?.id) return -1;
    return getRouteSortScore(a?.recommendationLabel) - getRouteSortScore(b?.recommendationLabel);
  });

  return (
    <div style={{ width: '100%', height: '100%', zIndex: 0 }}>
      <MapContainer 
        center={defaultCenter} 
        zoom={11} 
        minZoom={9}
        maxBounds={maxBounds}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        style={{ width: '100%', height: '100%', backgroundColor: '#0f172a' }} // Matches dark theme slightly
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />

        <MapController />

        {/* Subtle hospital markers from dataset */}
        {hospitalsData.map((hosp) => {
          // Don't render subtle marker if it's currently selected as destination
          if (destination && destination.name === hosp.name) return null;
          return (
            <Marker 
              key={`hosp-${hosp.id}`} 
              position={[hosp.latitude, hosp.longitude]} 
              icon={subtleHospitalIcon}
            />
          );
        })}

        {startLocation && journeyState === 'SETUP' && (
          <Marker position={[startLocation.coords.lat, startLocation.coords.lng]} icon={startIcon} />
        )}

        {destination && (
          <Marker position={[destination.coords.lat, destination.coords.lng]} icon={destIcon} />
        )}

        {journeyState === 'NAVIGATING' && ambulanceTelemetry && (
          <Marker 
            position={[ambulanceTelemetry.currentCoords.lat, ambulanceTelemetry.currentCoords.lng]} 
            icon={getAmbulanceIcon(ambulanceTelemetry.bearing || 0)} 
            zIndexOffset={1000} // Keep ambulance strictly on top
          />
        )}

        {journeyState === 'SETUP' && sortedRoutes.filter(r => r && r.id).map(route => {
          const isSelected = activeRoute?.id === route.id;
          const color = route.color || '#10b981';

          const baseWeight = isSelected ? 6 : 5;
          const casingWeight = baseWeight + 4;
          
          // Outer casing gets 1.0 opacity, inner gets slightly less if unselected
          const opacity = isSelected ? 0.95 : 0.75;
          
          if (!Array.isArray(route.polylineCoords) || route.polylineCoords.length === 0) return null;
          const positions = route.polylineCoords.map(c => [c.lat, c.lng] as [number, number]);

          return (
            <div key={route.id}>
              {/* Outer Casing */}
              <Polyline 
                positions={positions}
                color="#0f172a"
                weight={casingWeight}
                opacity={0.8}
                eventHandlers={{
                  click: () => useEmergencyStore.getState().setActiveRoute(route)
                }}
              />
              {/* Inner Line */}
              <Polyline 
                positions={positions}
                color={color}
                weight={baseWeight}
                opacity={opacity}
                eventHandlers={{
                  click: () => useEmergencyStore.getState().setActiveRoute(route)
                }}
              />
            </div>
          );
        })}

        {/* Active Route Render during NAVIGATING state */}
        {journeyState === 'NAVIGATING' && activeRoute && Array.isArray(activeRoute.polylineCoords) && (
          <div key={`active-${activeRoute.id}`}>
              <Polyline 
                positions={activeRoute.polylineCoords.map(c => [c.lat, c.lng])}
                color="#0f172a"
                weight={10}
                opacity={0.9}
              />
              <Polyline 
                positions={activeRoute.polylineCoords.map(c => [c.lat, c.lng])}
                color={activeRoute.color || '#10b981'}
                weight={6}
                opacity={1}
              />
          </div>
        )}

        {incidents.map((incident) => (
          <Marker 
            key={incident.id} 
            position={[incident.coords.lat, incident.coords.lng]} 
            icon={getIncidentIcon(incident.type)}
            zIndexOffset={500}
          />
        ))}
      </MapContainer>
    </div>
  );
}
