import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getCompanies, getDrones, getNodes, createNode, registerDrone, deleteDrone } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Node, DroneWithCompany, Company } from '@/types/database';
import { Network, Plus, TrendingDown, AlertCircle, MapPin, Trash2, Plane } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const InfrastructurePlannerPage: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [drones, setDrones] = useState<DroneWithCompany[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulationMode, setSimulationMode] = useState(false);
  const [newNode, setNewNode] = useState({
    name: '',
    lat: 37.7749,
    lng: -122.4194,
    capacity: 5,
  });
  const [newDrone, setNewDrone] = useState({
    name: '',
    tier: 'starter' as 'starter' | 'pro' | 'enterprise',
    lat: 37.7749,
    lng: -122.4194,
    company_id: '',
  });
  const [registering, setRegistering] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      setNewDrone((prev) => ({
        ...prev,
        company_id: profile?.company_id ?? '',
      }));
    }
  }, [profile]);

  const loadData = async () => {
    try {
      const [nodesData, dronesData, companiesData] = await Promise.all([
        getNodes(),
        getDrones(),
        getCompanies(),
      ]);
      setNodes(nodesData);
      setDrones(dronesData);
      setCompanies(companiesData);
    } catch (error) {
      toast.error('Failed to load infrastructure data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateNode = () => {
    if (!newNode.name || !newNode.lat || !newNode.lng) {
      toast.error('Please fill in all fields');
      return;
    }

    setSimulationMode(true);
    toast.success('Simulating node placement impact...');
  };

  const handleCreateNode = async () => {
    if (!newNode.name || !newNode.lat || !newNode.lng) {
      toast.error('Please fill in all fields');
      return;
    }

    if (profile?.role !== 'provider' && profile?.role !== 'admin') {
      toast.error('Only providers can create nodes');
      return;
    }

    try {
      await createNode({
        name: newNode.name,
        lat: newNode.lat,
        lng: newNode.lng,
        capacity: newNode.capacity,
      });
      toast.success('Node created successfully');
      setNewNode({
        name: '',
        lat: 37.7749,
        lng: -122.4194,
        capacity: 5,
      });
      setSimulationMode(false);
      loadData();
    } catch (error) {
      toast.error('Failed to create node');
      console.error(error);
    }
  };

  const handleRegisterDrone = async () => {
    if (!newDrone.name) {
      toast.error('Please enter a drone name');
      return;
    }

    const companyId =
      profile?.role === 'admin' ? newDrone.company_id : profile?.company_id;

    if (!companyId) {
      toast.error('Please select a company for this drone');
      return;
    }

    setRegistering(true);
    try {
      const response = await registerDrone({
        name: newDrone.name,
        company_id: companyId,
        tier: newDrone.tier,
        lat: newDrone.lat,
        lng: newDrone.lng,
      });
      toast.success(`Drone registered. ${response.amount_sol} SOL charged.`);
      setNewDrone((prev) => ({
        ...prev,
        name: '',
      }));
      loadData();
    } catch (error) {
      toast.error('Failed to register drone');
      console.error(error);
    } finally {
      setRegistering(false);
    }
  };

  const handleRemoveDrone = async (id: string) => {
    setRemovingId(id);
    try {
      await deleteDrone(id);
      toast.success('Drone removed from fleet');
      loadData();
    } catch (error) {
      toast.error('Failed to remove drone');
      console.error(error);
    } finally {
      setRemovingId(null);
    }
  };

  const calculateImpact = () => {
    const avgDeliveryTimeReduction = Math.random() * 15 + 5;
    const batteryFailurePrevention = Math.floor(Math.random() * 3 + 1);
    const congestionReduction = Math.random() * 20 + 10;

    return {
      deliveryTimeReduction: avgDeliveryTimeReduction.toFixed(1),
      batteryFailurePrevention,
      congestionReduction: congestionReduction.toFixed(1),
    };
  };

  const impact = simulationMode ? calculateImpact() : null;

  const visibleDrones =
    profile?.role === 'admin'
      ? drones
      : drones.filter((drone) => drone.company_id && drone.company_id === profile?.company_id);

  const mapCenter = { lat: newNode.lat, lng: newNode.lng };
  const mapZoom = 12;
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const mapSrc = mapsKey
    ? `https://www.google.com/maps/embed/v1/view?key=${mapsKey}&center=${mapCenter.lat},${mapCenter.lng}&zoom=${mapZoom}&language=en&region=us`
    : null;

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Infrastructure Planner</h1>
          <p className="text-muted-foreground">
            Plan and simulate new charging node placements
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Node Placement Simulator
              </CardTitle>
              <CardDescription>
                Visualize potential node locations and their impact
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
                {mapSrc ? (
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={mapSrc}
                    title="Node Placement Map"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                    Set VITE_GOOGLE_MAPS_API_KEY to load the map preview.
                  </div>
                )}
              </div>

              {simulationMode && impact && (
                <div className="space-y-3 p-4 bg-accent/50 rounded-lg border border-border">
                  <div className="font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    Simulated Impact Analysis
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-background rounded-lg">
                      <div className="flex items-center gap-2 text-chart-5">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xl font-bold">{impact.deliveryTimeReduction}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Delivery time reduction
                      </div>
                    </div>
                    <div className="p-3 bg-background rounded-lg">
                      <div className="flex items-center gap-2 text-chart-5">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xl font-bold">{impact.batteryFailurePrevention}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Battery failures prevented
                      </div>
                    </div>
                    <div className="p-3 bg-background rounded-lg">
                      <div className="flex items-center gap-2 text-chart-5">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xl font-bold">{impact.congestionReduction}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Congestion reduction
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Node Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="node-name">Node Name</Label>
                <Input
                  id="node-name"
                  placeholder="e.g., Node-SF-06"
                  value={newNode.name}
                  onChange={(e) => setNewNode({ ...newNode, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="node-lat">Latitude</Label>
                  <Input
                    id="node-lat"
                    type="number"
                    step="0.0001"
                    value={newNode.lat}
                    onChange={(e) => setNewNode({ ...newNode, lat: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="node-lng">Longitude</Label>
                  <Input
                    id="node-lng"
                    type="number"
                    step="0.0001"
                    value={newNode.lng}
                    onChange={(e) => setNewNode({ ...newNode, lng: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="node-capacity">Capacity</Label>
                <Input
                  id="node-capacity"
                  type="number"
                  min="1"
                  max="20"
                  value={newNode.capacity}
                  onChange={(e) => setNewNode({ ...newNode, capacity: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Button onClick={handleSimulateNode} variant="outline" className="w-full">
                  Simulate Impact
                </Button>
                {(profile?.role === 'provider' || profile?.role === 'admin') && (
                  <Button onClick={handleCreateNode} className="w-full">
                    Create Node
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5" />
                Drone Registration
              </CardTitle>
              <CardDescription>Register drones and simulate subscription purchases</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="drone-name">Drone Name</Label>
                <Input
                  id="drone-name"
                  placeholder="e.g., Drone-Zeta"
                  value={newDrone.name}
                  onChange={(e) => setNewDrone({ ...newDrone, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="drone-lat">Latitude</Label>
                  <Input
                    id="drone-lat"
                    type="number"
                    step="0.0001"
                    value={newDrone.lat}
                    onChange={(e) => setNewDrone({ ...newDrone, lat: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drone-lng">Longitude</Label>
                  <Input
                    id="drone-lng"
                    type="number"
                    step="0.0001"
                    value={newDrone.lng}
                    onChange={(e) => setNewDrone({ ...newDrone, lng: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subscription Tier</Label>
                <Select
                  value={newDrone.tier}
                  onValueChange={(value) =>
                    setNewDrone({ ...newDrone, tier: value as 'starter' | 'pro' | 'enterprise' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter - 0.5 SOL</SelectItem>
                    <SelectItem value="pro">Pro - 1.25 SOL</SelectItem>
                    <SelectItem value="enterprise">Enterprise - 2.5 SOL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                {profile?.role === 'admin' ? (
                  <Select
                    value={newDrone.company_id}
                    onValueChange={(value) => setNewDrone({ ...newDrone, company_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {companies.find((company) => company.id === profile?.company_id)?.name ||
                      'Assigned company'}
                  </div>
                )}
              </div>
              <Button onClick={handleRegisterDrone} className="w-full" disabled={registering}>
                {registering ? 'Registering...' : 'Register Drone'}
              </Button>
              <div className="space-y-2">
                <div className="text-sm font-medium">Subscription Notes</div>
                <div className="text-xs text-muted-foreground">
                  Starter: essentials for small fleets. Pro: higher throughput analytics. Enterprise:
                  priority support and SLA.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Existing Infrastructure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nodes.map((node) => (
                <div key={node.id} className="p-4 border border-border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{node.name}</div>
                      <div className="text-xs text-muted-foreground">Platform-owned</div>
                    </div>
                    <Badge variant={node.current_load >= node.capacity ? 'destructive' : 'outline'}>
                      {node.current_load}/{node.capacity}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    📍 {node.lat.toFixed(4)}, {node.lng.toFixed(4)}
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        node.current_load >= node.capacity
                          ? 'bg-destructive'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${(node.current_load / node.capacity) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5" />
              Registered Drones
            </CardTitle>
            <CardDescription>
              {profile?.role === 'admin'
                ? 'Viewing all drones across companies.'
                : 'Viewing drones registered to your company.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleDrones.map((drone) => (
                <div key={drone.id} className="p-4 border border-border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{drone.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {drone.company?.name || 'Unknown company'}
                      </div>
                    </div>
                    <Badge variant="outline">{drone.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    📍 {drone.lat.toFixed(4)}, {drone.lng.toFixed(4)}
                  </div>
                  <div className="text-xs text-muted-foreground">Battery: {drone.battery.toFixed(0)}%</div>
                  {(profile?.role === 'admin' || drone.company_id === profile?.company_id) && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleRemoveDrone(drone.id)}
                      disabled={removingId === drone.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {removingId === drone.id ? 'Removing...' : 'Remove Drone'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default InfrastructurePlannerPage;
