import { useEmergencyStore } from './store/useEmergencyStore';
import { LeafletMapWrapper } from './components/Map/LeafletMapWrapper';
import { ControlPanel } from './components/Sidebar/ControlPanel';
import { DemoControls } from './components/Controls/DemoControls';
import { useAmbulanceSimulator } from './hooks/useAmbulanceSimulator';
import { IntroAnimation } from './components/UI/IntroAnimation';
import { Homepage } from './components/UI/Homepage';
import { CalculatingTransition } from './components/UI/CalculatingTransition';
import { MissionComplete } from './components/UI/MissionComplete';

function App() {
  const appFlowState = useEmergencyStore(state => state.appFlowState);
  
  // Drive the simulation loop (only active when journeyState is NAVIGATING)
  useAmbulanceSimulator();

  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#0f172a' }}>
      
      {appFlowState === 'INTRO' && <IntroAnimation />}
      
      {appFlowState === 'HOMEPAGE' && <Homepage />}
      
      {appFlowState === 'CALCULATING' && <CalculatingTransition />}
      
      {(appFlowState === 'COMMAND_CENTER' || appFlowState === 'MISSION_COMPLETE') && (
        <>
          {/* Background Map */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <LeafletMapWrapper />
          </div>

          {/* Overlays */}
          {appFlowState === 'COMMAND_CENTER' && (
            <>
              <ControlPanel />
              <DemoControls />
            </>
          )}
        </>
      )}

      {appFlowState === 'MISSION_COMPLETE' && <MissionComplete />}

    </div>
  );
}

export default App;
