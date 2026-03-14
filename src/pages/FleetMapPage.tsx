import React, { useEffect, useState, useRef } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDrones, getNodes, subscribeToDrones, subscribeToNodes } from '@/db/api';
import { runSimulation } from '@/lib/simulation';
import type { DroneWithCompany, NodeWithCompany } from '@/types/database';
import { Battery, Zap, MapPin, Activity } from 'lucide-react';
import { toast } from 'sonner';

const FleetMapPage: React.FC = () => {
  const [drones, setDrones] = useState<DroneWithCompany[]>([]);
  const [nodes, setNodes] = useState<NodeWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const simulationInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();

    const dronesChannel = subscribeToDrones((payload) => {
      setDrones(payload.data);
    });

    const nodesChannel = subscribeToNodes((payload) => {
      setNodes(payload.data);
    });

    simulationInterval.current = setInterval(() => {
      runSimulationCycle();
    }, 2000);

    return () => {
      dronesChannel.unsubscribe();
      nodesChannel.unsubscribe();
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
      }
    };
  }, []);

  const loadData = async () => {
    try {
      const [dronesData, nodesData] = await Promise.all([getDrones(), getNodes()]);
      setDrones(dronesData);
      setNodes(nodesData);
    } catch (error) {
      toast.error('Failed to load fleet data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const runSimulationCycle = async () => {
    try {
      const [currentDrones, currentNodes] = await Promise.all([getDrones(), getNodes()]);
      await runSimulation(currentDrones, currentNodes);
    } catch (error) {
      console.error('Simulation error:', error);
    }
  };

  const getBatteryColor = (battery: number) => {
    if (battery > 60) return 'text-chart-5';
    if (battery > 30) return 'text-chart-4';
    return 'text-destructive';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      idle: { variant: 'secondary', label: 'Idle' },
      flying: { variant: 'default', label: 'Flying' },
      charging: { variant: 'outline', label: 'Charging' },
      en_route: { variant: 'default', label: 'En Route' },
    };
    const config = variants[status] || variants.idle;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const mapCenter = { lat: 37.7749, lng: -122.4194 };
  const mapZoom = 10;
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const mapSrc = mapsKey
    ? `https://www.google.com/maps/embed/v1/view?key=${mapsKey}&center=${mapCenter.lat},${mapCenter.lng}&zoom=${mapZoom}&language=en&region=us`
    : null;

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Live Fleet Map</h1>
            <p className="text-muted-foreground">Real-time drone fleet monitoring</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse text-primary" />
            <span>Live Updates</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Fleet Visualization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                {mapSrc ? (
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={mapSrc}
                    title="Fleet Map"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                    Set VITE_GOOGLE_MAPS_API_KEY to load the map preview.
                  </div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{drones.length}</div>
                  <div className="text-xs text-muted-foreground">Total Drones</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-secondary">{nodes.length}</div>
                  <div className="text-xs text-muted-foreground">Charging Nodes</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-chart-5">
                    {drones.filter((d) => d.status === 'flying').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Active Flights</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-chart-4">
                    {drones.filter((d) => d.status === 'charging').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Charging</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Drone Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full bg-muted" />
                  ))
                ) : (
                  drones.map((drone) => (
                    <div
                      key={drone.id}
                      className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm">{drone.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {drone.company?.name || 'Unknown'}
                          </div>
                        </div>
                        {getStatusBadge(drone.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Battery className={`h-4 w-4 ${getBatteryColor(drone.battery)}`} />
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${getBatteryColor(drone.battery).replace('text-', 'bg-')}`}
                            style={{ width: `${drone.battery}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{drone.battery.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Charging Nodes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full bg-muted" />
                ))
              ) : (
                nodes.map((node) => (
                  <div key={node.id} className="p-4 border border-border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
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
                      {node.lat.toFixed(4)}, {node.lng.toFixed(4)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default FleetMapPage;
