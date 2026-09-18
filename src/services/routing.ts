import { Coordinates, Incident, RouteDetails } from '../store/useEmergencyStore';

// Haversine distance in meters
function getDistance(p1: Coordinates, p2: Coordinates): number {
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

function getIncidentPenalty(coords: Coordinates[], incidents: Incident[]): number {
  let penaltySeconds = 0;
  for (const incident of incidents) {
    const intersects = coords.some((point) => getDistance(point, incident.coords) < 150);
    if (intersects) {
      switch (incident.type) {
        case 'CLOSURE':
          penaltySeconds += 999999;
          break;
        case 'ACCIDENT':
          penaltySeconds += incident.severity === 'HIGH' ? 600 : 300;
          break;
        case 'CONSTRUCTION':
          penaltySeconds += 180;
          break;
        case 'TRAFFIC_SPIKE':
          penaltySeconds += 240;
          break;
      }
    }
  }
  return penaltySeconds;
}

// Offset a coordinate perpendicularly by roughly `offsetMeters`
function getOffsetWaypoint(p1: Coordinates, p2: Coordinates, offsetMeters: number): Coordinates {
  // Midpoint
  const midLat = (p1.lat + p2.lat) / 2;
  const midLng = (p1.lng + p2.lng) / 2;
  
  // Angle
  const dy = p2.lat - p1.lat;
  const dx = p2.lng - p1.lng;
  const angle = Math.atan2(dy, dx);
  
  // Perpendicular angle
  const perpAngle = angle + Math.PI / 2;
  
  // Roughly convert meters to degrees (1 deg lat ~= 111km, 1 deg lng ~= 111km * cos(lat))
  const latOffset = (Math.sin(perpAngle) * offsetMeters) / 111000;
  const lngOffset = (Math.cos(perpAngle) * offsetMeters) / (111000 * Math.cos(midLat * (Math.PI / 180)));
  
  return {
    lat: midLat + latOffset,
    lng: midLng + lngOffset
  };
}

async function fetchOSRMRoute(origin: Coordinates, destination: Coordinates, via?: Coordinates) {
  const coordsStr = via 
    ? `${origin.lng},${origin.lat};${via.lng},${via.lat};${destination.lng},${destination.lat}`
    : `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    
  // alternatives=2 is standard when not using via points, but with via points OSRM often only returns 1 route.
  // We'll ask for alternatives anyway, but we just want routes.
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&alternatives=2&steps=true`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    return [];
  }
  return data.routes;
}

export async function calculateEmergencyRoutes(
  origin: Coordinates,
  destination: Coordinates,
  incidents: Incident[]
): Promise<{ bestRoute: RouteDetails; alternatives: RouteDetails[] }> {
  
  // 1. Initial Fetch
  let rawRoutes = await fetchOSRMRoute(origin, destination);
  if (rawRoutes.length === 0) {
    throw new Error('No routes found from OSRM');
  }

  // 2. Fallback Generation (if fewer than 3)
  if (rawRoutes.length < 3) {
    // Generate an artificial waypoint to force OSRM into another corridor
    const w1 = getOffsetWaypoint(origin, destination, 1500); // offset 1.5km to one side
    const w2 = getOffsetWaypoint(origin, destination, -1500); // offset 1.5km to other side

    if (rawRoutes.length === 1) {
      const extra1 = await fetchOSRMRoute(origin, destination, w1);
      const extra2 = await fetchOSRMRoute(origin, destination, w2);
      rawRoutes = [...rawRoutes, ...(extra1.slice(0, 1)), ...(extra2.slice(0, 1))];
    } else if (rawRoutes.length === 2) {
      const extra1 = await fetchOSRMRoute(origin, destination, w1);
      rawRoutes = [...rawRoutes, ...(extra1.slice(0, 1))];
    }
  }

  // Deduplicate routes based on geometric similarity (distance)
  const uniqueRoutes: any[] = [];
  for (const route of rawRoutes) {
    if (!route.geometry || !Array.isArray(route.geometry.coordinates)) continue;
    
    // Simple heuristic: if distance is extremely close to an existing one, it might be the same
    const isDuplicate = uniqueRoutes.some(ur => Math.abs(ur.distance - route.distance) < 50);
    if (!isDuplicate) {
      uniqueRoutes.push(route);
    }
    if (uniqueRoutes.length === 3) break;
  }

  const processedRoutes = uniqueRoutes.map((route: any, index: number) => {
    const polylineCoords: Coordinates[] = route.geometry.coordinates.map((coord: [number, number]) => ({
      lng: coord[0],
      lat: coord[1]
    }));

    const maneuvers = (route.legs && route.legs[0] && route.legs[0].steps) 
      ? route.legs[0].steps 
      : [];

    const baseDuration = route.duration || 0;
    const distanceValue = route.distance || 0; // meters

    const incidentPenalty = getIncidentPenalty(polylineCoords, incidents);
    const totalScoreSeconds = baseDuration + incidentPenalty;
    
    let riskScore: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (incidentPenalty >= 999999) riskScore = 'HIGH';
    else if (incidentPenalty > 0) riskScore = 'MEDIUM';
    
    let trafficStatus: 'LIGHT' | 'MODERATE' | 'HEAVY' = 'LIGHT';
    if (incidentPenalty > 300) trafficStatus = 'HEAVY';
    else if (incidentPenalty > 0) trafficStatus = 'MODERATE';

    const distanceText = distanceValue > 1000 
      ? `${(distanceValue / 1000).toFixed(1)} km` 
      : `${Math.round(distanceValue)} m`;
      
    return {
      id: `route-${index}-${Math.random().toString(36).substr(2, 5)}`,
      distanceText,
      distanceValue,
      durationText: '', 
      durationValue: totalScoreSeconds, 
      riskScore,
      trafficStatus,
      polylineCoords,
      maneuvers,
      score: totalScoreSeconds,
      recommendationLabel: '',
      recommendationReason: '',
      color: '#10b981' // Will be updated below
    };
  });

  processedRoutes.sort((a: any, b: any) => a.score - b.score);

  const [bestRoute, ...alternatives] = processedRoutes;

  const formatDuration = (seconds: number) => {
    const mins = Math.ceil(seconds / 60);
    return mins > 60 ? `${Math.floor(mins/60)} h ${mins%60} min` : `${mins} min`;
  };

  if (bestRoute) {
    bestRoute.durationText = formatDuration(bestRoute.score);
    bestRoute.recommendationLabel = 'AI RECOMMENDED';
    bestRoute.recommendationReason = 'Lowest combined travel time and route risk.';
    bestRoute.color = '#10b981'; // Green
  }
  
  if (alternatives[0]) {
    alternatives[0].durationText = formatDuration(alternatives[0].score);
    alternatives[0].recommendationLabel = 'ALTERNATIVE';
    alternatives[0].recommendationReason = 'Moderate traffic / moderate risk.';
    alternatives[0].color = '#f59e0b'; // Yellow/Orange
  }
  
  if (alternatives[1]) {
    alternatives[1].durationText = formatDuration(alternatives[1].score);
    alternatives[1].recommendationLabel = 'HIGH RISK';
    alternatives[1].recommendationReason = 'Construction / incident / heavy delay.';
    alternatives[1].color = '#ef4444'; // Red
  }

  return {
    bestRoute,
    alternatives
  };
}
