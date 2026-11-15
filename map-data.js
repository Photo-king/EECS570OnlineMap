// Coordinates use the full SVG viewBox, including its border and title.
export const floors = [
  { id: 'ground', label: 'G', name: 'Ground floor', width: 2280, height: 1650, file: 'Ground' },
  { id: 'first', label: '1', name: 'First floor', width: 2280, height: 1650, file: 'First' },
  { id: 'second', label: '2', name: 'Second floor', width: 2280, height: 1650, file: 'Second' },
  { id: 'union', label: 'All', name: 'Union overview', width: 2600, height: 2695, file: 'Union' },
].map(f => ({ ...f, map: `Mapsv1.0/Dental_Kellogg_${f.file}.svg`, anchors: [] }));
// First-floor corners supplied by the user on 2026-11-14 (Google Maps).
// SVG wall coordinates transformed by translate(-39, 80); see docs/calibration.md.
floors.find(f => f.id === 'first').anchors = [
  { id: 1, latitude: 42.27957036070683, longitude: -83.73637611538639, x: 1005.43, y: 581.68 },
  { id: 2, latitude: 42.27957957305385, longitude: -83.7356838237391, x: 1534.99, y: 579.071 },
  { id: 3, latitude: 42.27881494366865, longitude: -83.73681066535926, x: 649.95, y: 1375.01 },
  { id: 4, latitude: 42.27881770740602, longitude: -83.73665502425149, x: 769.14, y: 1375.01 },
  { id: 5, latitude: 42.278884037066696, longitude: -83.73550950569839, x: 1665.52, y: 1318.9 },
];
// Shared physical corners: WGS84 coordinates are common; SVG placement differs.
export const buildingCorners = floors.find(f => f.id === 'first').anchors.map(({id,latitude,longitude}) => ({id,latitude,longitude}));
const sharedSvgCorners = {
  ground: [[1,1119.521,611.115], [2,1662.043,606.261], [3,769.6197,1402.7717], [4,888.8257,1402.7717]],
  second: [[1,1125.84,607.5665], [2,1656.8625,605.6135], [3,772.6125,1401.3575], [4,892.6125,1401.3575]],
};
for (const [id, corners] of Object.entries(sharedSvgCorners)) {
  floors.find(f => f.id === id).anchors = corners.map(([id,x,y]) => ({...buildingCorners.find(c => c.id === id),x,y}));
}
// Display extent includes the building and immediate surroundings, not page legends.
// It is not a room or walkability boundary.
const bounds = {
  ground: {left:720,top:290,right:1830,bottom:1470},
  first: {left:540,top:240,right:1730,bottom:1430},
  second: {left:720,top:290,right:1830,bottom:1510},
};
for (const f of floors) f.bounds = bounds[f.id] || null;

// Raster registration: matching exterior corners picked on the supplied north-up image.
// Provisional image registration; original WGS84 control points remain unchanged.
export const outside = {
  map:'Mapsv1.0/mapoutside.png', width:1842, height:1208,
  anchors: buildingCorners.map((c,i) => ({...c, x:[1124.5,1277.5,1035.5,1067.5,1298][i], y:[526.5,523.5,727.5,727.5,707.5][i]})),
};
for (const f of floors.filter(f=>f.id!=='union')) f.buildingMap=`public/maps/${f.id}-building.svg`;
// Keep the original union link ID compatible with existing QR codes.
floors.unshift(floors.splice(floors.findIndex(f=>f.id==='union'),1)[0]);
floors[0].name='Overview'; floors[0].label='All';
