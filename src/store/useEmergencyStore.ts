import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type Coordinates = { lat: number; lng: number };

export type LocationDetails = {
  coords: Coordinates;
  address: string;
  name?: string;
};

export type IncidentType = 'CONSTRUCTION' | 'ACCIDENT' | 'CLOSURE' | 'TRAFFIC_SPIKE';

export type Incident = {
  id: string;
  type: IncidentType;
  coords: Coordinates;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
};

export type RouteDetails = {
  id: string;
  distanceText: string;
  distanceValue: number; // meters
  durationText: string;
  durationValue: number; // seconds
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  trafficStatus: 'LIGHT' | 'MODERATE' | 'HEAVY';
  polylineCoords: Coordinates[];
  maneuvers: any[]; // Stores OSRM steps
  recommendationLabel?: string;
  recommendationReason?: string;
  color: string;
};

export type Telemetry = {
  currentCoords: Coordinates;
  speedKmH: number;
  progressPercentage: number;
  distanceRemainingText: string;
  timeRemainingText: string;
  status: 'EN_ROUTE' | 'REROUTING' | 'ARRIVED' | 'OFF_ROUTE';
  bearing?: number;
  nextManeuver?: string;
};

export type EventLogItem = {
  id: string;
  timestamp: Date;
  message: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
};

export type AppFlowState = 'INTRO' | 'HOMEPAGE' | 'CALCULATING' | 'COMMAND_CENTER' | 'MISSION_COMPLETE';

interface EmergencyState {
  // Application Flow
  appFlowState: AppFlowState;
  setAppFlowState: (state: AppFlowState) => void;

  // Config
  startLocation: LocationDetails | null;
  destination: LocationDetails | null;
  journeyState: 'SETUP' | 'NAVIGATING' | 'ARRIVED';
  
  // Routing
  activeRoute: RouteDetails | null;
  alternativeRoutes: RouteDetails[];
  
  // Telemetry & Simulation
  ambulanceTelemetry: Telemetry | null;
  incidents: Incident[];
  eventLog: EventLogItem[];
  routeError: string | null;

  // Actions
  setStartLocation: (loc: LocationDetails | null) => void;
  setDestination: (loc: LocationDetails | null) => void;
  calculateRoutes: () => Promise<void>;
  setActiveRoute: (route: RouteDetails) => void;
  startEmergency: (route: RouteDetails) => void;
  updateTelemetry: (telemetry: Partial<Telemetry>) => void;
  recalculateFromCurrentLocation: () => Promise<void>;
  addIncident: (incident: Omit<Incident, 'id'>) => void;
  clearIncidents: () => void;
  addLog: (msg: string, type: EventLogItem['type']) => void;
  resetJourney: () => void;
}

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  appFlowState: 'INTRO',
  setAppFlowState: (state) => set({ appFlowState: state }),

  startLocation: null,
  destination: null,
  journeyState: 'SETUP',
  activeRoute: null,
  alternativeRoutes: [],
  ambulanceTelemetry: null,
  incidents: [],
  eventLog: [],
  routeError: null,

  setStartLocation: (loc) => set({ startLocation: loc, activeRoute: null, alternativeRoutes: [], journeyState: 'SETUP', routeError: null }),
  setDestination: (loc) => set({ destination: loc, activeRoute: null, alternativeRoutes: [], journeyState: 'SETUP', routeError: null }),

  calculateRoutes: async () => {
    const { startLocation, destination, incidents } = get();
    if (!startLocation || !destination) return;
    
    set({ routeError: null, appFlowState: 'CALCULATING' });
    
    try {
      // Lazy import routing to avoid circular deps if any
      const { calculateEmergencyRoutes } = await import('../services/routing');
      
      const { bestRoute, alternatives } = await calculateEmergencyRoutes(
        startLocation.coords,
        destination.coords,
        incidents
      );
      
      // Simulate calculation transition time for UX
      await new Promise(resolve => setTimeout(resolve, 2000));

      set({
        activeRoute: bestRoute || null,
        alternativeRoutes: [bestRoute, ...(alternatives || [])].filter(Boolean) as RouteDetails[],
        appFlowState: 'COMMAND_CENTER'
      });
      get().addLog(`Calculated ${1 + alternatives.length} route options.`, 'INFO');
    } catch (error: any) {
      console.error(error);
      const msg = 'Unable to calculate a road route. Please check the selected pickup and hospital locations.';
      set({ routeError: msg, activeRoute: null, alternativeRoutes: [], appFlowState: 'HOMEPAGE' });
      get().addLog(msg, 'CRITICAL');
    }
  },

  setActiveRoute: (route) => set({ activeRoute: route }),

  startEmergency: (route) => {
    const startLoc = get().startLocation;
    if (!startLoc) return;

    set({
      journeyState: 'NAVIGATING',
      activeRoute: route,
      ambulanceTelemetry: {
        currentCoords: startLoc.coords,
        speedKmH: 0,
        progressPercentage: 0,
        distanceRemainingText: route.distanceText,
        timeRemainingText: route.durationText,
        status: 'EN_ROUTE',
        bearing: 0,
        nextManeuver: 'Head straight',
      },
    });
    get().addLog(`Emergency route initiated to ${get().destination?.name || 'Destination'}`, 'INFO');
  },

  updateTelemetry: (update) => set((state) => ({
    ambulanceTelemetry: state.ambulanceTelemetry ? { ...state.ambulanceTelemetry, ...update } : null
  })),

  recalculateFromCurrentLocation: async () => {
    const { ambulanceTelemetry, destination, incidents } = get();
    if (!ambulanceTelemetry || !destination) return;

    get().addLog('Recalculating emergency route...', 'WARNING');
    get().updateTelemetry({ status: 'REROUTING' });

    try {
      const { calculateEmergencyRoutes } = await import('../services/routing');
      const { bestRoute, alternatives } = await calculateEmergencyRoutes(
        ambulanceTelemetry.currentCoords,
        destination.coords,
        incidents
      );
      set({
        activeRoute: bestRoute || null,
        alternativeRoutes: [bestRoute, ...(alternatives || [])].filter(Boolean) as RouteDetails[]
      });
      get().updateTelemetry({ status: 'EN_ROUTE' });
      get().addLog(`Rerouted successfully. ETA: ${bestRoute.durationText}`, 'SUCCESS');
    } catch (error) {
      get().addLog('Failed to calculate alternative route.', 'CRITICAL');
      get().updateTelemetry({ status: 'EN_ROUTE' }); // resume anyway
    }
  },

  addIncident: (incidentData) => {
    const newIncident: Incident = { ...incidentData, id: uuidv4() };
    set((state) => ({ incidents: [...state.incidents, newIncident] }));
    get().addLog(`Incident Detected: ${newIncident.description}`, 'WARNING');
  },

  clearIncidents: () => set({ incidents: [] }),

  addLog: (message, type = 'INFO') => set((state) => ({
    eventLog: [{ id: uuidv4(), timestamp: new Date(), message, type }, ...state.eventLog].slice(0, 50)
  })),

  resetJourney: () => set({
    startLocation: null,
    destination: null,
    journeyState: 'SETUP',
    activeRoute: null,
    alternativeRoutes: [],
    ambulanceTelemetry: null,
    incidents: [],
    eventLog: [],
    appFlowState: 'HOMEPAGE'
  }),
}));
