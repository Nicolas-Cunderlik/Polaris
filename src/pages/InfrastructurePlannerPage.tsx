import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getNodes, getCompanies, createNode } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import type { NodeWithCompany, Company } from '@/types/database';
import { Network, Plus, TrendingDown, AlertCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const InfrastructurePlannerPage: React.FC = () => {
  const [nodes, setNodes] = useState<NodeWithCompany[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulationMode, setSimulationMode] = useState(false);
  const [newNode, setNewNode] = useState({
    name: '',
    lat: 37.7749,
    lng: -122.4194,
    capacity: 5,
    owner_company_id: '',
  });
  const { profile } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [nodesData, companiesData] = await Promise.all([getNodes(), getCompanies()]);
      setNodes(nodesData);
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
        owner_company_id: newNode.owner_company_id || null,
      });
      toast.success('Node created successfully');
      setNewNode({
        name: '',
        lat: 37.7749,
        lng: -122.4194,
        capacity: 5,
        owner_company_id: '',
      });
      setSimulationMode(false);
      loadData();
    } catch (error) {
      toast.error('Failed to create node');
      console.error(error);
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

  const mapCenter = { lat: newNode.lat, lng: newNode.lng };
  const mapZoom = 12;

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
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyB_LJOYJL-84SMuxNB7LtRGhxEQLjswvy0&center=${mapCenter.lat},${mapCenter.lng}&zoom=${mapZoom}&language=en&region=cn`}
                  title="Node Placement Map"
                />
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
                <Label htmlFor="node-owner">Owner Company</Label>
                <Select
                  value={newNode.owner_company_id}
                  onValueChange={(value) => setNewNode({ ...newNode, owner_company_id: value })}
                >
                  <SelectTrigger id="node-owner">
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
                      <div className="text-xs text-muted-foreground">
                        {node.owner_company?.name || 'Public'}
                      </div>
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
      </div>
    </MainLayout>
  );
};

export default InfrastructurePlannerPage;
