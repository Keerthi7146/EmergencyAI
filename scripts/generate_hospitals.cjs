const fs = require('fs');
const path = require('path');

const bbox = '12.2,79.2,13.6,80.4';
const query = `[out:json][timeout:60];
(
  nwr["amenity"="hospital"](${bbox});
  nwr["healthcare"="hospital"](${bbox});
);
out center tags;`;

console.log('Fetching hospitals from Overpass API (Chennai Region)...');

async function main() {
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query), {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'EmergencyAI/1.0 (test@example.com)'
      }
    });
    
    if (!res.ok) {
      console.error(`Overpass API returned status code ${res.status}`);
      const text = await res.text();
      console.error(text);
      return;
    }

    const json = await res.json();
    processRecords(json.elements);
  } catch (e) {
    console.error('Failed to fetch:', e);
  }
}

main();

function processRecords(elements) {
  const hospitalsMap = new Map();
  let govCount = 0;
  let pvtCount = 0;

  for (const el of elements) {
    if (!el.tags || !el.tags.name) continue;

    const lat = el.lat || (el.center && el.center.lat);
    const lon = el.lon || (el.center && el.center.lon);

    if (!lat || !lon) continue;

    const name = el.tags.name.trim();
    let isGov = false;
    const nameLower = name.toLowerCase();
    const operator = el.tags.operator || '';
    const operatorLower = operator.toLowerCase();
    
    if (
      nameLower.includes('govt') || 
      nameLower.includes('government') ||
      nameLower.includes('gh ') ||
      nameLower === 'gh' ||
      nameLower.includes('rajiv gandhi') ||
      nameLower.includes('stanley') ||
      nameLower.includes('kilpauk medical college') ||
      nameLower.includes('royapettah') ||
      nameLower.includes('primary health centre') ||
      nameLower.includes('phc') ||
      operatorLower.includes('government') ||
      operatorLower.includes('govt') ||
      operatorLower.includes('corporation') ||
      el.tags['operator:type'] === 'public' ||
      el.tags['operator:type'] === 'government'
    ) {
      isGov = true;
    }

    let locality = el.tags['addr:suburb'] || el.tags['addr:village'] || el.tags['addr:neighbourhood'] || '';
    let city = el.tags['addr:city'] || 'Chennai';
    let district = el.tags['addr:district'] || '';

    const record = {
      id: el.id.toString(),
      name: name,
      latitude: lat,
      longitude: lon,
      address: el.tags['addr:full'] || el.tags['addr:street'] || '',
      locality: locality,
      city: city,
      district: district,
      pincode: el.tags['addr:postcode'] || '',
      operator: operator,
      operatorType: isGov ? 'Government' : (el.tags['operator:type'] || 'Private'),
      emergency: el.tags.emergency === 'yes' ? 'Available' : (el.tags.emergency === 'no' ? 'Not Available' : 'Unknown'),
      phone: el.tags.phone || el.tags['contact:phone'] || '',
      website: el.tags.website || el.tags['contact:website'] || '',
      source: 'OpenStreetMap',
      aliases: []
    };

    if (hospitalsMap.has(name)) {
      const existing = hospitalsMap.get(name);
      const existingScore = Object.values(existing).filter(Boolean).length;
      const newScore = Object.values(record).filter(Boolean).length;
      if (newScore > existingScore) {
        hospitalsMap.set(name, record);
      }
    } else {
      hospitalsMap.set(name, record);
    }
  }

  const finalHospitals = Array.from(hospitalsMap.values());
  
  const aliasMap = [
    { match: "rajiv gandhi", aliases: ["GH Chennai", "Government General Hospital", "Rajiv Gandhi Govt General Hospital"] },
    { match: "kilpauk", aliases: ["Kilpauk Govt Hospital", "Government Kilpauk Hospital", "KMC"] },
    { match: "stanley", aliases: ["Stanley Hospital", "Stanley Govt Hospital"] },
    { match: "royapettah", aliases: ["Royapettah GH", "GRH"] },
    { match: "sri ramachandra", aliases: ["Sri Ramachandra Hospital", "SRMC"] },
    { match: "madras medical mission", aliases: ["MMM Hospital"] },
    { match: "miot", aliases: ["MIOT International"] },
    { match: "apollo", aliases: ["Apollo Main Hospital"] }
  ];

  for (const hosp of finalHospitals) {
    for (const mapping of aliasMap) {
      if (hosp.name.toLowerCase().includes(mapping.match)) {
        hosp.aliases = mapping.aliases;
      }
    }
    if (hosp.operatorType === 'Government') govCount++;
    else pvtCount++;
  }

  const outDir = path.join(__dirname, '../src/data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, 'hospitals.json');
  fs.writeFileSync(outFile, JSON.stringify(finalHospitals, null, 2));

  console.log(`Saved ${finalHospitals.length} unique hospitals to ${outFile}`);
  console.log(`- Government/Public: ${govCount}`);
  console.log(`- Private/Other: ${pvtCount}`);
}
