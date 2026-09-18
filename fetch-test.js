fetch('https://router.project-osrm.org/route/v1/driving/80.222,13.091;80.270,13.082?overview=full&geometries=geojson&alternatives=2&steps=true')
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)))
  .catch(console.error);
