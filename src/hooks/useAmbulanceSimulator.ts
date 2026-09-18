import { useEffect, useRef } from 'react';
import { useEmergencyStore, Coordinates } from '../store/useEmergencyStore';

// Haversine distance in meters
function getDistance(p1: Coordinates, p2: Coordinates): number {
  if (!p1 || !p2) return 0;
  const R = 6378137;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLong = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLong / 2) *
      Math.sin(dLong / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function interpolate(p1: Coordinates, p2: Coordinates, fraction: number): Coordinates {
  return {
    lat: p1.lat + (p2.lat - p1.lat) * fraction,
    lng: p1.lng + (p2.lng - p1.lng) * fraction,
  };
}

function getBearing(p1: Coordinates, p2: Coordinates): number {
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const lat1 = p1.lat * Math.PI / 180;
  const lat2 = p2.lat * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

// Maps OSRM modifier to human readable instruction
function getManeuverText(step: any): string {
  if (!step || !step.maneuver) return "Continue straight";
  
  const type = step.maneuver.type;
  const modifier = step.maneuver.modifier;
  const name = step.name || "the road";

  if (type === "arrive") return "Arriving at hospital";
  
  switch(modifier) {
    case 'left': return `Turn left onto ${name}`;
    case 'right': return `Turn right onto ${name}`;
    case 'slight left': return `Slight left onto ${name}`;
    case 'slight right': return `Slight right onto ${name}`;
    case 'sharp left': return `Sharp left onto ${name}`;
    case 'sharp right': return `Sharp right onto ${name}`;
    case 'u-turn': return `Make a U-turn`;
    default: return `Continue straight on ${name}`;
  }
}

export function useAmbulanceSimulator() {
  const { 
    journeyState, 
    activeRoute, 
    updateTelemetry, 
    addLog,
    incidents,
    recalculateFromCurrentLocation,
    setAppFlowState
  } = useEmergencyStore();
  
  const simulationRef = useRef<{
    distanceTraveled: number;
    lastTimestamp: number | null;
    isRerouting: boolean;
  }>({
    distanceTraveled: 0,
    lastTimestamp: null,
    isRerouting: false
  });

  useEffect(() => {
    if (journeyState === 'NAVIGATING' && activeRoute) {
      simulationRef.current.distanceTraveled = 0;
      simulationRef.current.lastTimestamp = null;
      simulationRef.current.isRerouting = false;
    }
  }, [activeRoute?.id, journeyState]);

  useEffect(() => {
    if (journeyState !== 'NAVIGATING' || !activeRoute) {
      return;
    }

    let animationFrameId: number;
    
    // Compute total polyline distance for accurate mapping
    const path = activeRoute.polylineCoords;
    if (!Array.isArray(path) || path.length < 2) return;
    
    // Pre-calculate cumulative distances for fast lookup
    const cumulativeDistances = [0];
    for (let i = 1; i < path.length; i++) {
      cumulativeDistances.push(cumulativeDistances[i-1] + getDistance(path[i-1], path[i]));
    }
    const totalPathDistance = cumulativeDistances[cumulativeDistances.length - 1];
    
    // Pre-calculate maneuver distances
    let currentManeuverDistance = 0;
    const maneuversList = (activeRoute.maneuvers || []).map((step: any) => {
      const startDist = currentManeuverDistance;
      currentManeuverDistance += (step.distance || 0);
      return {
        ...step,
        startDistance: startDist,
        endDistance: currentManeuverDistance,
        text: getManeuverText(step)
      };
    });

    const animate = async (timestamp: number) => {
      const state = simulationRef.current;
      
      if (state.isRerouting) {
        state.lastTimestamp = timestamp;
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      
      if (!state.lastTimestamp) state.lastTimestamp = timestamp;
      const deltaTime = (timestamp - state.lastTimestamp) / 1000; 
      state.lastTimestamp = timestamp;
      
      if (state.distanceTraveled >= totalPathDistance) {
        updateTelemetry({ 
          status: 'ARRIVED', 
          speedKmH: 0, 
          progressPercentage: 100,
          distanceRemainingText: '0 m',
          timeRemainingText: '0 mins',
          nextManeuver: 'Arrived at destination'
        });
        addLog('Ambulance has arrived at the destination', 'SUCCESS');
        useEmergencyStore.setState({ journeyState: 'ARRIVED', appFlowState: 'MISSION_COMPLETE' });
        return;
      }
      
      // Determine current coordinate exactly matching distanceTraveled
      let currentSegmentIndex = 0;
      for (let i = 0; i < cumulativeDistances.length - 1; i++) {
        if (state.distanceTraveled >= cumulativeDistances[i] && state.distanceTraveled <= cumulativeDistances[i+1]) {
          currentSegmentIndex = i;
          break;
        }
      }
      
      const p1 = path[currentSegmentIndex];
      const p2 = path[currentSegmentIndex + 1] || p1;
      const segmentLen = getDistance(p1, p2);
      const distInSegment = state.distanceTraveled - cumulativeDistances[currentSegmentIndex];
      const fraction = segmentLen > 0 ? distInSegment / segmentLen : 1;
      const currentPos = interpolate(p1, p2, Math.min(fraction, 1));
      
      // Check incidents for rerouting
      let needsReroute = false;
      let speedModifier = 1.0;
      
      for (const inc of incidents) {
        const distToInc = getDistance(currentPos, inc.coords);
        if (distToInc < 300) {
          if (inc.type === 'CLOSURE' || (inc.type === 'ACCIDENT' && inc.severity === 'HIGH')) {
            needsReroute = true;
            break;
          } else if (inc.type === 'CONSTRUCTION') {
            speedModifier = 0.3; 
          } else if (inc.type === 'TRAFFIC_SPIKE') {
            speedModifier = 0.4;
          } else {
            speedModifier = 0.5;
          }
        }
      }
      
      if (needsReroute) {
        state.isRerouting = true;
        recalculateFromCurrentLocation().finally(() => {
          // Dependency array resets distance
        });
        return;
      }
      
      // Controlled simulation speed (Multiplier ~12 makes a 15min drive take ~1.2 mins)
      const SIMULATION_MULTIPLIER = 12;
      const avgSpeedMs = (activeRoute.distanceValue / activeRoute.durationValue) || 12.5; // ~45 km/h
      const currentSpeedMs = avgSpeedMs * speedModifier * SIMULATION_MULTIPLIER;
      
      // Advance distance robustly (no teleportation possible, we just increase absolute distance)
      state.distanceTraveled += currentSpeedMs * deltaTime;
      if (state.distanceTraveled > totalPathDistance) state.distanceTraveled = totalPathDistance;
      
      // Calculate bearing and display stats
      const currentBearing = getBearing(p1, p2);
      const displaySpeedKmh = Math.round((avgSpeedMs * speedModifier) * 3.6);
      const progressPercentage = Math.min(100, Math.round((state.distanceTraveled / totalPathDistance) * 100));
      
      // Determine active maneuver based on distanceTraveled
      let activeManeuverText = "Continue straight";
      let distToNextTurn = 0;
      
      // Find the maneuver we are currently inside
      for (let i = 0; i < maneuversList.length; i++) {
        const m = maneuversList[i];
        if (state.distanceTraveled >= m.startDistance && state.distanceTraveled < m.endDistance) {
          // We are currently traveling this step. 
          // The NEXT maneuver is what we actually want to display as instruction.
          const nextM = maneuversList[i+1];
          if (nextM) {
            activeManeuverText = nextM.text;
            distToNextTurn = m.endDistance - state.distanceTraveled;
          } else {
            activeManeuverText = m.text; // Last step (arrive)
            distToNextTurn = m.endDistance - state.distanceTraveled;
          }
          break;
        }
      }
      
      // Combine maneuver and distance remaining
      const maneuverDisplay = distToNextTurn > 10 
        ? `${activeManeuverText} in ${Math.round(distToNextTurn)}m` 
        : activeManeuverText;

      // Calculate ETA and Distance Remaining
      const distanceRemainingValue = Math.max(0, totalPathDistance - state.distanceTraveled);
      const distanceRemainingText = distanceRemainingValue > 1000 
        ? `${(distanceRemainingValue / 1000).toFixed(1)} km` 
        : `${Math.round(distanceRemainingValue)} m`;
        
      const timeRemainingSeconds = (activeRoute.durationValue || 0) * (distanceRemainingValue / Math.max(1, totalPathDistance));
      const timeRemainingMins = Math.max(1, Math.ceil(timeRemainingSeconds / 60));
      const timeRemainingText = timeRemainingMins > 60 
        ? `${Math.floor(timeRemainingMins / 60)}h ${timeRemainingMins % 60}m` 
        : `${timeRemainingMins} min`;

      updateTelemetry({
        currentCoords: currentPos,
        speedKmH: displaySpeedKmh,
        progressPercentage,
        bearing: currentBearing,
        nextManeuver: maneuverDisplay,
        distanceRemainingText,
        timeRemainingText
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [journeyState, activeRoute?.id, incidents]); 
}
