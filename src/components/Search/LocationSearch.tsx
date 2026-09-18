import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { LocationDetails } from '../../store/useEmergencyStore';
import hospitalsData from '../../data/hospitals.json';
import { LocationLoading } from '../UI/LocationLoading';

interface LocationSearchProps {
  placeholder: string;
  onPlaceSelected: (location: LocationDetails) => void;
  className?: string;
  icon?: React.ReactNode;
  filterType?: 'hospital' | 'general';
}

interface SearchResult {
  id: string;
  name: string;
  address: string;
  coords: { lat: number; lng: number };
  type: 'hospital' | 'photon';
  isGovernment?: boolean;
  score?: number;
  precision?: string;
}

export function LocationSearch({ placeholder, onPlaceSelected, className = '', icon, filterType = 'general' }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track whether we are in the middle of a selection to avoid reopening the dropdown
  // or re-triggering search immediately after selecting.
  const [suppressSearch, setSuppressSearch] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Geographic bounds for Chennai Metro region to penalize out-of-bounds results
  const CHENNAI_BBOX = {
    minLat: 12.2,
    maxLat: 13.6,
    minLng: 79.2,
    maxLng: 80.4
  };

  const isWithinChennaiBounds = (lat: number, lng: number) => {
    return lat >= CHENNAI_BBOX.minLat && lat <= CHENNAI_BBOX.maxLat &&
           lng >= CHENNAI_BBOX.minLng && lng <= CHENNAI_BBOX.maxLng;
  };

  useEffect(() => {
    // For hospitals, allow 1 character (e.g. "G"). For general, require at least 2.
    const minLength = filterType === 'hospital' ? 1 : 2;
    if (!query || query.length < minLength || suppressSearch) {
      setResults([]);
      setShowDropdown(false);
      setHasSearched(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      
      if (filterType === 'hospital') {
        // --- LOCAL HOSPITAL SEARCH ---
        const normalizeStr = (str: string) => (str || '').toLowerCase().replace(/[.,]/g, '').trim().replace(/\s+/g, ' ');
        const lowerQuery = normalizeStr(query);
        const tokens = lowerQuery.split(' ').filter(Boolean);
        
        const isGovSearch = ['g', 'go', 'gov', 'govt', 'government', 'gh'].includes(lowerQuery);
        
        const matches = hospitalsData.map(hosp => {
          let score = 0;
          
          const nameLower = normalizeStr(hosp.name);
          const localityLower = normalizeStr(hosp.locality);
          const aliasesLower = (hosp.aliases || []).map(normalizeStr);
          
          // Helper for exact matches and acronyms
          const matchesGovt = hosp.operatorType === 'Government';
          
          if (nameLower === lowerQuery) score += 1000;
          else if (nameLower.startsWith(lowerQuery)) score += 500;
          else if (nameLower.includes(lowerQuery)) score += 100;
          
          if (aliasesLower.some(a => a === lowerQuery)) score += 900;
          else if (aliasesLower.some(a => a.startsWith(lowerQuery))) score += 400;
          else if (aliasesLower.some(a => a.includes(lowerQuery))) score += 50;

          if (localityLower === lowerQuery) score += 80;
          else if (localityLower.includes(lowerQuery)) score += 40;
          
          // Operator/Govt boost
          if (isGovSearch && matchesGovt) {
            score += 800; // Force government hospitals to top for 'g', 'govt'
          }
          
          // Token matches (to support partial words like "mmm hospital")
          let matchedTokens = 0;
          for (const token of tokens) {
            if (['hospital', 'hospitals'].includes(token)) continue;
            
            if (nameLower.includes(token) || aliasesLower.some(a => a.includes(token))) {
              matchedTokens++;
              score += 20;
            } else if (localityLower.includes(token)) {
              matchedTokens++;
              score += 10;
            } else if (matchesGovt && ['g', 'gov', 'govt', 'government', 'gh'].includes(token)) {
              matchedTokens++;
              score += 10;
            }
          }
          
          // Require at least some token matches unless it's a broad govt search
          const requiredTokens = tokens.filter(t => !['hospital', 'hospitals'].includes(t));
          if (requiredTokens.length > 0 && matchedTokens === 0 && !isGovSearch) {
            score = 0; 
          }

          return { hosp, score };
        }).filter(m => m.score > 0);

        matches.sort((a, b) => b.score - a.score);
        
        const mappedResults: SearchResult[] = matches.slice(0, 10).map(m => ({
          id: m.hosp.id,
          name: m.hosp.name,
          address: `${m.hosp.locality}, ${m.hosp.city}`,
          coords: { lat: m.hosp.latitude, lng: m.hosp.longitude },
          type: 'hospital',
          isGovernment: m.hosp.operatorType === 'Government',
          score: m.score
        }));

        setResults(mappedResults);
        setHasSearched(true);
        setShowDropdown(true); // Always show dropdown to allow 'No results' display
        setLoading(false);

      } else {
        // --- PHOTON SEARCH WITH RANKING ---
        try {
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&bbox=${CHENNAI_BBOX.minLng},${CHENNAI_BBOX.minLat},${CHENNAI_BBOX.maxLng},${CHENNAI_BBOX.maxLat}&limit=10`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.features) {
            const normalizeStr = (s: string) => (s || '').toLowerCase().replace(/[.,-]/g, ' ').trim().replace(/\s+/g, ' ');
            const fullQuery = normalizeStr(query);
            const queryTokens = fullQuery.split(' ').filter(Boolean);

            const ranked = data.features.map((feature: any) => {
              const prop = feature.properties;
              const lat = feature.geometry.coordinates[1];
              const lng = feature.geometry.coordinates[0];
              
              let score = 0;
              
              const name = normalizeStr(prop.name);
              const street = normalizeStr(prop.street);
              const locality = normalizeStr(prop.locality || prop.district || prop.suburb || prop.neighbourhood);
              const city = normalizeStr(prop.city);
              const state = normalizeStr(prop.state || prop.county);
              const house = normalizeStr(prop.housenumber);

              const fullAddress = [name, house, street, locality, city, state].filter(Boolean).join(' ');

              // 1. CHENNAI BOUNDING BOX / REGION FILTER
              const inBounds = isWithinChennaiBounds(lat, lng);
              if (!inBounds) {
                 score -= 2000; // Massive penalty for outside bounding box
              } else {
                 score += 100;
              }

              // 2. Token Matching
              let matchedTokens = 0;
              for (const token of queryTokens) {
                if (fullAddress.includes(token)) {
                  matchedTokens++;
                  score += 10;
                  
                  if (locality.includes(token)) score += 30; // heavy weight for locality match
                  if (city.includes(token)) score += 20;
                  if (street.includes(token)) score += 20;
                  if (name.includes(token)) score += 20;
                } else {
                  score -= 20; // Penalty for tokens that don't match anything
                }
              }

              if (matchedTokens === queryTokens.length && queryTokens.length > 0) {
                 score += 200; // Bonus for matching all tokens
              }

              // 3. Exact Sequence Matches
              if (locality === fullQuery || locality.includes(fullQuery)) score += 400;
              if (street === fullQuery || street.includes(fullQuery)) score += 300;
              if (name === fullQuery || name.includes(fullQuery)) score += 200;

              // 4. Locality Validation (The core fix)
              const commaParts = query.split(',').map(normalizeStr).filter(Boolean);
              if (commaParts.length > 1) {
                const potentialLocality = commaParts[commaParts.length - 1]; 
                const potentialLocality2 = commaParts.length > 2 ? commaParts[commaParts.length - 2] : null;
                
                if (potentialLocality !== 'chennai' && potentialLocality !== 'tamil nadu' && potentialLocality !== 'india') {
                   if (!locality.includes(potentialLocality) && !city.includes(potentialLocality) && !name.includes(potentialLocality)) {
                      score -= 500; // Massive penalty for explicit locality mismatch
                   } else {
                      score += 400; // Massive boost for matching explicit locality
                   }
                } else if (potentialLocality2 && potentialLocality2 !== 'chennai' && potentialLocality2 !== 'tamil nadu' && potentialLocality2 !== 'india') {
                   if (!locality.includes(potentialLocality2) && !city.includes(potentialLocality2) && !name.includes(potentialLocality2)) {
                      score -= 500;
                   } else {
                      score += 400;
                   }
                }
              } else if (queryTokens.length >= 2) {
                 // No commas, check last two tokens
                 const lastTwo = queryTokens.slice(-2).join(' ');
                 if (lastTwo !== 'chennai' && lastTwo !== 'tamil nadu' && lastTwo !== 'india') {
                   if (locality.includes(lastTwo)) {
                      score += 300;
                   }
                 }
              }

              // 5. Precision determination
              let precision = "CITY LEVEL";
              if (prop.housenumber) {
                precision = "HOUSE / ADDRESS LEVEL";
                if (fullQuery.includes(house)) score += 100;
              } else if (prop.street) {
                precision = "STREET LEVEL";
              } else if (prop.locality || prop.district || prop.suburb || prop.neighbourhood || prop.name) {
                precision = "LOCALITY LEVEL";
              }

              // Build a clean, non-fabricated address
              const parts = [
                prop.housenumber,
                prop.name,
                prop.street,
                prop.locality || prop.suburb || prop.neighbourhood,
                prop.district,
                prop.city
              ].filter(Boolean);
              
              const uniqueParts: string[] = [];
              for (const part of parts) {
                 const pNorm = normalizeStr(part);
                 if (!uniqueParts.some(u => normalizeStr(u) === pNorm)) {
                    uniqueParts.push(part);
                 }
              }

              const address = uniqueParts.join(', ');
              const displayName = prop.name || prop.street || prop.locality || parts[0] || '';

              return {
                id: prop.osm_id ? prop.osm_id.toString() : Math.random().toString(),
                name: displayName,
                address: address,
                coords: { lat, lng },
                type: 'photon' as const,
                score,
                precision,
                _normAddress: normalizeStr(address)
              };
            });

            // Sort by score
            ranked.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
            
            // Deduplicate
            const uniqueResults: SearchResult[] = [];
            for (const r of ranked) {
               if (r.score < -100) continue; // Reject poorly scored items
               
               let isDup = false;
               for (const u of uniqueResults) {
                  // Exact normalized string match
                  if (u.address && r.address && normalizeStr(u.address) === normalizeStr(r.address)) {
                      isDup = true; 
                      break; 
                  }
                  
                  // Coordinate distance check (~20m)
                  const R = 6371e3;
                  const dLat = (u.coords.lat - r.coords.lat) * Math.PI / 180;
                  const dLng = (u.coords.lng - r.coords.lng) * Math.PI / 180;
                  const lat1 = r.coords.lat * Math.PI / 180;
                  const lat2 = u.coords.lat * Math.PI / 180;
                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                            Math.sin(dLng/2) * Math.sin(dLng/2) * Math.cos(lat1) * Math.cos(lat2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  if (R * c < 20) { isDup = true; break; }
               }
               
               if (!isDup) {
                  uniqueResults.push(r);
                  if (uniqueResults.length >= 6) break;
               }
            }

            setResults(uniqueResults);
            setHasSearched(true);
            setShowDropdown(true);
          }
        } catch (error) {
          console.error('Error fetching location from Photon:', error);
        } finally {
          setLoading(false);
        }
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, filterType, suppressSearch]);

  const handleSelect = (result: SearchResult) => {
    setSuppressSearch(true);
    setShowDropdown(false);
    setIsVerifying(true);
    setQuery(result.type === 'hospital' ? result.name : result.address);

    // Show the "Verifying Location" overlay briefly
    setTimeout(() => {
      onPlaceSelected({
        coords: result.coords,
        address: result.address,
        name: result.name,
      });
      setIsVerifying(false);
      setResults([]);
    }, 1200); // 1.2s to show the smooth animation
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (suppressSearch) setSuppressSearch(false);
    if (!showDropdown) setShowDropdown(true);
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      <div className="relative flex items-center">
        <div className="absolute left-3 text-gray-400">
          {icon || <Search size={18} />}
        </div>
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => { if (!suppressSearch && (results.length > 0 || hasSearched)) setShowDropdown(true); }}
          onBlur={() => {
            // Very short timeout to allow onMouseDown on the dropdown to fire first
            setTimeout(() => setShowDropdown(false), 200);
          }}
          style={{
            width: '100%',
            backgroundColor: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '10px 16px 10px 40px',
            color: 'white',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocusCapture={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlurCapture={(e) => {
            e.target.style.borderColor = '#334155';
          }}
        />
        {loading && <div className="absolute right-3 text-xs text-gray-400">⏳</div>}
      </div>

      {showDropdown && (
        <div 
          className="absolute w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden"
          style={{ 
            top: '100%', left: 0, right: 0, 
            backgroundColor: '#1e293b', 
            border: '1px solid #334155',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
          }}
        >
          {results.length > 0 ? (
            results.map((res, i) => (
              <div
                key={res.id + i}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(res); }} // onMouseDown fires before onBlur
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid #334155' : 'none',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ color: 'white', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {res.name}
                  {res.type === 'hospital' && res.isGovernment && (
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      GOVT
                    </span>
                  )}
                  {res.type === 'hospital' && !res.isGovernment && (
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      PVT
                    </span>
                  )}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{res.address}</span>
                  {res.precision && (
                    <span style={{ color: '#64748b', fontSize: '10px' }}>Precision: {res.precision}</span>
                  )}
                </div>
              </div>
            ))
          ) : hasSearched && !loading ? (
            <div style={{ padding: '16px', color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>
              {filterType === 'hospital' ? 'No matching hospitals found' : 'No matches found in Chennai region'}
            </div>
          ) : null}
        </div>
      )}

      {isVerifying && <LocationLoading />}
    </div>
  );
}
