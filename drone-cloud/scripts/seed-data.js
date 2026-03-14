// Seed data script
// Placeholder for populating initial data

const seedData = {
  companies: [
    { id: '1', name: 'UberDrone', walletAddress: 'solana_address_1' },
    { id: '2', name: 'WarehouseNet', walletAddress: 'solana_address_2' }
  ],
  nodes: [
    { id: '1', location: { lat: 37.7749, lng: -122.4194 }, capacity: 10, ownerCompany: 'platform' },
    { id: '2', location: { lat: 37.7849, lng: -122.4094 }, capacity: 8, ownerCompany: 'platform' }
  ],
  drones: [
    { id: '1', companyId: '1', location: { lat: 37.7649, lng: -122.4294 }, battery: 80, status: 'flying', destination: { lat: 37.7749, lng: -122.4194 } }
  ]
};

console.log('Seed data:', JSON.stringify(seedData, null, 2));