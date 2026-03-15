const buildNodeSvg = (opacity = 1) => `
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
    <circle cx="5" cy="5" r="4" fill="#22c55e" fill-opacity="${opacity}" />
  </svg>
`;

const buildDroneSvg = (color = '#0b0b0b') => `
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 12L5 5M12 12L19 5M12 12L5 19M12 12L19 19"
      stroke="${color}"
      stroke-width="2"
      stroke-linecap="round"
    />
    <rect x="9" y="10" width="6" height="4" rx="1" fill="${color}" />
    <circle cx="5" cy="5" r="2" fill="${color}" />
    <circle cx="19" cy="5" r="2" fill="${color}" />
    <circle cx="5" cy="19" r="2" fill="${color}" />
    <circle cx="19" cy="19" r="2" fill="${color}" />
  </svg>
`;

const buildPlacementPinSvg = () => `
  <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" focusable="false">
    <circle cx="17" cy="17" r="12" fill="#06a9e0" fill-opacity="0.18" />
    <circle cx="17" cy="17" r="8" fill="#06a9e0" fill-opacity="0.28" />
    <path
      d="M17 4C12.03 4 8 8.03 8 13c0 6.2 7.31 14.54 8.06 15.39a1.25 1.25 0 0 0 1.88 0C18.69 27.54 26 19.2 26 13c0-4.97-4.03-9-9-9Z"
      fill="#06a9e0"
      stroke="#ffffff"
      stroke-width="1.4"
    />
    <circle cx="17" cy="13" r="3.4" fill="#ffffff" />
  </svg>
`;

export const createNodeIcon = (L: any, opacity = 1) =>
  L.divIcon({
    className: 'map-node-icon',
    html: buildNodeSvg(opacity),
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -8],
  });

export const createDroneIcon = (L: any, color = '#0b0b0b') =>
  L.divIcon({
    className: 'map-drone-icon',
    html: buildDroneSvg(color),
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });

export const createPlacementPinIcon = (L: any) =>
  L.divIcon({
    className: 'map-placement-pin-icon',
    html: buildPlacementPinSvg(),
    iconSize: [34, 34],
    iconAnchor: [17, 30],
    popupAnchor: [0, -28],
  });
