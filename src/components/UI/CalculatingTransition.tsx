import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import './CalculatingTransition.css';

export function CalculatingTransition() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // These steps align roughly with the 2-second timeout we have in useEmergencyStore
    const t1 = setTimeout(() => setStep(1), 300);
    const t2 = setTimeout(() => setStep(2), 600);
    const t3 = setTimeout(() => setStep(3), 900);
    const t4 = setTimeout(() => setStep(4), 1200);
    const t5 = setTimeout(() => setStep(5), 1500);
    const t6 = setTimeout(() => setStep(6), 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, []);

  return (
    <div className="calc-container">
      <div className="calc-content">
        <div className="calc-brand" style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <img src="/emergencyai-logo.png" alt="EmergencyAI Logo" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
        </div>

        <h2 className="calc-title">ANALYZING EMERGENCY ROUTE</h2>

        <div className="calc-steps">
          <div className={`calc-step ${step >= 1 ? 'active' : ''}`}>
            <CheckCircle2 size={18} className={step >= 1 ? "text-green-500" : "text-slate-600"} />
            <span>Pickup location verified</span>
          </div>
          <div className={`calc-step ${step >= 2 ? 'active' : ''}`}>
            <CheckCircle2 size={18} className={step >= 2 ? "text-green-500" : "text-slate-600"} />
            <span>Destination hospital identified</span>
          </div>
          <div className={`calc-step ${step >= 3 ? 'active' : ''}`}>
            <CheckCircle2 size={18} className={step >= 3 ? "text-green-500" : "text-slate-600"} />
            <span>Analyzing road network</span>
          </div>
          <div className={`calc-step ${step >= 4 ? 'active' : ''}`}>
            <CheckCircle2 size={18} className={step >= 4 ? "text-green-500" : "text-slate-600"} />
            <span>Evaluating alternative routes</span>
          </div>
          <div className={`calc-step ${step >= 5 ? 'active' : ''}`}>
            <CheckCircle2 size={18} className={step >= 5 ? "text-green-500" : "text-slate-600"} />
            <span>Checking incidents</span>
          </div>
          <div className={`calc-step ${step >= 6 ? 'active' : ''}`}>
            <CheckCircle2 size={18} className={step >= 6 ? "text-green-500" : "text-slate-600"} />
            <span>Preparing navigation</span>
          </div>
        </div>

        <div className="calc-progress-wrapper">
          <div className="calc-progress-track">
            <img 
              src="/tn108_transparent.png" 
              alt="Ambulance" 
              className="calc-ambulance" 
              style={{ left: `${Math.min((step / 6) * 100, 100)}%` }}
            />
            <div className="calc-progress-fill" style={{ width: `${Math.min((step / 6) * 100, 100)}%` }}></div>
          </div>
          <p className="calc-progress-text">EmergencyAI is actively preparing your route...</p>
        </div>
      </div>
    </div>
  );
}
