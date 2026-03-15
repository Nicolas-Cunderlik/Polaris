const buildNodeSvg = (opacity = 1) => `
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
    <circle cx="5" cy="5" r="4" fill="#22c55e" fill-opacity="${opacity}" />
  </svg>
`;

const buildDroneSvg = () => `
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 12L5 5M12 12L19 5M12 12L5 19M12 12L19 19"
      stroke="#0b0b0b"
      stroke-width="2"
      stroke-linecap="round"
    />
    <rect x="9" y="10" width="6" height="4" rx="1" fill="#0b0b0b" />
    <circle cx="5" cy="5" r="2" fill="#0b0b0b" />
    <circle cx="19" cy="5" r="2" fill="#0b0b0b" />
    <circle cx="5" cy="19" r="2" fill="#0b0b0b" />
    <circle cx="19" cy="19" r="2" fill="#0b0b0b" />
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

export const createDroneIcon = (L: any) =>
  L.divIcon({
    className: 'map-drone-icon',
    html: buildDroneSvg(),
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
