// Survey-style waypoints along land-side road corridors; [longitude, latitude].
export const corridors = [
  {
    name: 'OMR · Sholinganallur',
    landmark: 'Rajiv Gandhi Salai · near Sholinganallur junction',
    points: [
      [80.2314, 12.901],
      [80.2321, 12.915],
      [80.237, 12.938],
      [80.245, 12.969],
    ],
  },
  {
    name: 'GST Road · Tambaram',
    landmark: 'Grand Southern Trunk Road · Tambaram corridor',
    points: [
      [80.114, 12.923],
      [80.132, 12.951],
      [80.164, 12.984],
      [80.184, 13.009],
    ],
  },
  {
    name: 'Anna Salai · Guindy',
    landmark: 'Anna Salai · Guindy to Saidapet',
    points: [
      [80.209, 13.007],
      [80.221, 13.021],
      [80.235, 13.039],
      [80.251, 13.057],
    ],
  },
  {
    name: 'Velachery',
    landmark: 'Velachery Main Road · near Vijayanagar',
    points: [
      [80.217, 12.966],
      [80.218, 12.98],
      [80.215, 12.994],
      [80.211, 13.004],
    ],
  },
  {
    name: 'Poonamallee High Road',
    landmark: 'Poonamallee High Road · Maduravoyal corridor',
    points: [
      [80.142, 13.056],
      [80.166, 13.067],
      [80.191, 13.075],
      [80.219, 13.079],
    ],
  },
  {
    name: 'ECR · Injambakkam',
    landmark: 'East Coast Road · Injambakkam corridor',
    points: [
      [80.249, 12.878],
      [80.251, 12.901],
      [80.255, 12.922],
      [80.259, 12.941],
    ],
  },
  {
    name: 'Outer Ring Road',
    landmark: 'Outer Ring Road · west Tambaram corridor',
    points: [
      [80.075, 12.932],
      [80.071, 12.965],
      [80.066, 12.99],
      [80.071, 13.025],
    ],
  },
] as const;
export const CHENNAI_BOUNDS: [[number, number], [number, number]] = [
  [79.96, 12.76],
  [80.34, 13.22],
];
export function validCoordinate(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 12.76 &&
    lat <= 13.22 &&
    lng >= 79.96 &&
    lng <= 80.3
  );
}
