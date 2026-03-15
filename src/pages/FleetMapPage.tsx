import React, { useEffect, useState, useRef } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDrones, getNodes, subscribeToDrones, subscribeToNodes } from '@/db/api';
import { runSimulation } from '@/lib/simulation';
import { loadMockScenario } from '@/lib/mockData';
import type { DroneWithCompany, Node } from '@/types/database';
import type { MockScenario } from '@/types/mock';
import { Zap, MapPin, Activity } from 'lucide-react';
import { createDroneIcon, createNodeIcon } from '@/lib/leafletIcons';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const FleetMapPage: React.FC = () => {
  const [drones, setDrones] = useState<DroneWithCompany[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(true);
  const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const droneMarkersRef = useRef<Map<string, any>>(new Map());
  const nodeMarkersRef = useRef<Map<string, any>>(new Map());
  const overlayLayersRef = useRef<{ risk?: any; flights?: any; heat?: any }>({});
  const droneAnimationRef = useRef<Map<string, number>>(new Map());
  const lastDronePositionRef = useRef<Map<string, [number, number]>>(new Map());
  const hasFitBoundsRef = useRef(false);
  const [leafletReady, setLeafletReady] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mockScenario, setMockScenario] = useState<MockScenario | null>(null);
  const [mockDrones, setMockDrones] = useState<DroneWithCompany[]>([]);
  const [showOverlays, setShowOverlays] = useState(true);
  const mockStateRef = useRef<Map<string, { battery: number }>>(new Map());
  const mockLastTickRef = useRef<number>(0);
  const { profile } = useAuth();
  const mockEnabled = import.meta.env.VITE_ML_MOCK === '1';

  const companyDrones = mockEnabled
    ? mockDrones
    : profile?.role === 'admin'
      ? drones
      : drones.filter((drone) => drone.company_id && drone.company_id === profile?.company_id);
  const displayDrones = apiAvailable ? companyDrones : [];
  const displayNodes = apiAvailable ? nodes : [];

  useEffect(() => {
    loadData();

    if (mockEnabled) {
      return;
    }

    const dronesChannel = subscribeToDrones((payload) => {
      setApiAvailable(true);
      setDrones(payload.data);
    });

    const nodesChannel = subscribeToNodes((payload) => {
      setApiAvailable(true);
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
  }, [mockEnabled]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L) {
      setLeafletReady(false);
      return;
    }
    setLeafletReady(true);
    if (!mapRef.current || leafletMapRef.current) return;

    const montrealLat = 45.5017;
    const montrealLng = -73.5673;

    const map = L.map(mapRef.current, {
      center: [montrealLat, montrealLng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });
    leafletMapRef.current = map;
    setMapReady(true);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB',
    }).addTo(map);

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    const map = leafletMapRef.current;
    if (!L || !map || !mapReady) return;

    const nextIds = new Set(displayNodes.map((node) => node.id));
    nodeMarkersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        nodeMarkersRef.current.delete(id);
      }
    });

    displayNodes.forEach((node) => {
      const existing = nodeMarkersRef.current.get(node.id);
      if (existing) {
        existing.setLatLng([node.lat, node.lng]);
      } else {
        const marker = L.marker([node.lat, node.lng], {
          icon: createNodeIcon(L),
        })
          .bindPopup(node.name)
          .addTo(map);
        nodeMarkersRef.current.set(node.id, marker);
      }
    });
  }, [displayNodes, mapReady]);

  useEffect(() => {
    const L = (window as any).L;
    const map = leafletMapRef.current;
    if (!L || !map || !mapReady) return;

    const nextIds = new Set(displayDrones.map((drone) => drone.id));
    droneMarkersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        const anim = droneAnimationRef.current.get(id);
        if (anim) {
          cancelAnimationFrame(anim);
          droneAnimationRef.current.delete(id);
        }
        marker.remove();
        droneMarkersRef.current.delete(id);
        lastDronePositionRef.current.delete(id);
      }
    });

    displayDrones.forEach((drone) => {
      const existing = droneMarkersRef.current.get(drone.id);
      const nextPosition: [number, number] = [drone.lat, drone.lng];
      const current = existing ? existing.getLatLng() : { lat: drone.lat, lng: drone.lng };
      if (existing) {
        const start: [number, number] = [current.lat, current.lng];
        const end = nextPosition;
        const duration = 1800;
        const startTime = performance.now();
        const prevAnim = droneAnimationRef.current.get(drone.id);
        if (prevAnim) {
          cancelAnimationFrame(prevAnim);
        }
        const animate = (time: number) => {
          const progress = Math.min((time - startTime) / duration, 1);
          const lat = start[0] + (end[0] - start[0]) * progress;
          const lng = start[1] + (end[1] - start[1]) * progress;
          existing.setLatLng([lat, lng]);
          if (progress < 1) {
            const id = requestAnimationFrame(animate);
            droneAnimationRef.current.set(drone.id, id);
          }
        };
        const id = requestAnimationFrame(animate);
        droneAnimationRef.current.set(drone.id, id);
      } else {
        const marker = L.marker([drone.lat, drone.lng], {
          icon: createDroneIcon(L),
        })
          .bindPopup(drone.name || drone.id)
          .addTo(map);
        droneMarkersRef.current.set(drone.id, marker);
      }
      lastDronePositionRef.current.set(drone.id, nextPosition);
    });
  }, [displayDrones, mapReady]);

  useEffect(() => {
    if (!mockEnabled || !mockScenario) return;

    const start = performance.now();
    const flightPlans = new Map(
      mockScenario.flight_plans.map((plan) => [plan.drone_id, plan.waypoints])
    );

    const speedScale = 2; // seconds per simulated minute in the eta field
    const drainPerMinute = 0.6;
    const chargePerMinute = 1.2;
    mockLastTickRef.current = performance.now();
    if (mockStateRef.current.size === 0) {
      mockScenario.drones.forEach((drone) => {
        mockStateRef.current.set(drone.id, { battery: drone.battery });
      });
    }

    const tick = () => {
      const now = performance.now();
      const deltaSec = Math.max(0, (now - mockLastTickRef.current) / 1000);
      const deltaSimMinutes = deltaSec / speedScale;
      mockLastTickRef.current = now;
      const elapsedSec = (now - start) / 1000;

      const nextDrones = mockScenario.drones.map((drone) => {
        const waypoints = flightPlans.get(drone.id);
        if (!waypoints || waypoints.length < 2) {
          return drone as DroneWithCompany;
        }

        const totalDuration =
          waypoints[waypoints.length - 1].eta * speedScale || 1;
        const t = elapsedSec % totalDuration;

        let idx = 0;
        for (let i = 0; i < waypoints.length - 1; i += 1) {
          const startEta = waypoints[i].eta * speedScale;
          const endEta = waypoints[i + 1].eta * speedScale;
          if (t >= startEta && t <= endEta) {
            idx = i;
            break;
          }
        }

        const from = waypoints[idx];
        const to = waypoints[Math.min(idx + 1, waypoints.length - 1)];
        const segStart = from.eta * speedScale;
        const segEnd = Math.max(segStart + 0.001, to.eta * speedScale);
        const segProgress = Math.min(1, Math.max(0, (t - segStart) / (segEnd - segStart)));

        const lat = from.lat + (to.lat - from.lat) * segProgress;
        const lng = from.lng + (to.lng - from.lng) * segProgress;
        const rawStatus = segProgress >= 0.9 ? to.status : from.status;
        const status =
          rawStatus === 'charging'
            ? 'charging'
            : rawStatus === 'reroute'
              ? 'en_route'
              : rawStatus === 'service'
                ? 'idle'
                : rawStatus === 'pickup' || rawStatus === 'dropoff'
                  ? 'en_route'
                  : 'flying';

        const state = mockStateRef.current.get(drone.id) ?? { battery: drone.battery };
        if (status === 'charging') {
          state.battery = Math.min(100, state.battery + chargePerMinute * deltaSimMinutes);
        } else if (status === 'flying' || status === 'en_route') {
          state.battery = Math.max(0, state.battery - drainPerMinute * deltaSimMinutes);
        }
        mockStateRef.current.set(drone.id, state);

        return {
          ...(drone as DroneWithCompany),
          lat,
          lng,
          status,
          battery: state.battery,
          updated_at: new Date().toISOString(),
        };
      });

      setMockDrones(nextDrones);
    };

    const interval = setInterval(tick, 1000 / 24);
    tick();

    return () => {
      clearInterval(interval);
    };
  }, [mockEnabled, mockScenario]);

  useEffect(() => {
    const L = (window as any).L;
    const map = leafletMapRef.current;
    if (!L || !map || !mapReady) return;

    Object.values(overlayLayersRef.current).forEach((layer) => layer?.remove());
    overlayLayersRef.current = {};

    if (!mockEnabled || !mockScenario || !showOverlays) return;

    const riskLayer = L.layerGroup();
    mockScenario.risk_zones.forEach((zone) => {
      if (zone.type === 'circle') {
        L.circle([zone.center.lat, zone.center.lng], {
          radius: zone.radius_m,
          color: '#ef4444',
          weight: 2,
          fillColor: '#ef4444',
          fillOpacity: 0.15,
        }).addTo(riskLayer);
      } else {
        L.polygon(zone.points.map((point) => [point.lat, point.lng]), {
          color: '#f97316',
          weight: 2,
          fillColor: '#f97316',
          fillOpacity: 0.12,
        }).addTo(riskLayer);
      }
    });
    riskLayer.addTo(map);

    const flightLayer = L.layerGroup();
    mockScenario.flight_plans.forEach((plan) => {
      const points = plan.waypoints.map((point) => [point.lat, point.lng]);
      L.polyline(points, {
        color: plan.rerouted ? '#f97316' : '#2563eb',
        weight: 1.5,
        opacity: 0.2,
        dashArray: plan.rerouted ? '4 6' : undefined,
      }).addTo(flightLayer);
    });
    flightLayer.addTo(map);

    const heatLayer = L.layerGroup();
    const grid = new Map<string, { lat: number; lng: number; count: number }>();
    const gridSize = 0.01;
    mockScenario.flight_plans.forEach((plan) => {
      plan.waypoints.forEach((point, index) => {
        if (index % 2 !== 0) return;
        const latKey = Math.round(point.lat / gridSize) * gridSize;
        const lngKey = Math.round(point.lng / gridSize) * gridSize;
        const key = `${latKey.toFixed(4)}|${lngKey.toFixed(4)}`;
        const existing = grid.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          grid.set(key, { lat: latKey, lng: lngKey, count: 1 });
        }
      });
    });

    grid.forEach((cell) => {
      const intensity = Math.min(1, cell.count / 12);
      const radius = 180 + 420 * intensity;
      const color = intensity > 0.7 ? '#ef4444' : intensity > 0.4 ? '#f97316' : '#22c55e';
      L.circle([cell.lat, cell.lng], {
        radius,
        color,
        weight: 0,
        fillColor: color,
        fillOpacity: 0.18,
      }).addTo(heatLayer);
    });
    heatLayer.addTo(map);

    overlayLayersRef.current = { risk: riskLayer, flights: flightLayer, heat: heatLayer };
  }, [mockEnabled, mockScenario, showOverlays, mapReady]);

  useEffect(() => {
    const L = (window as any).L;
    const map = leafletMapRef.current;
    if (!L || !map || !mapReady || hasFitBoundsRef.current) return;

    const points = [
      ...displayDrones.map((drone) => [drone.lat, drone.lng] as [number, number]),
      ...displayNodes.map((node) => [node.lat, node.lng] as [number, number]),
    ];
    if (points.length === 0) return;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    hasFitBoundsRef.current = true;
  }, [displayDrones, displayNodes, mapReady]);

  const loadData = async () => {
    try {
      if (mockEnabled) {
        const scenario = await loadMockScenario();
        setMockScenario(scenario);
        mockStateRef.current = new Map(
          scenario.drones.map((drone) => [drone.id, { battery: drone.battery }])
        );
        setApiAvailable(true);
        setMockDrones(scenario.drones as DroneWithCompany[]);
        setNodes(scenario.nodes as Node[]);
      } else {
        const [dronesData, nodesData] = await Promise.all([getDrones(), getNodes()]);
        setApiAvailable(true);
        setDrones(dronesData);
        setNodes(nodesData);
      }
    } catch (error) {
      toast.error('Failed to load fleet data');
      console.error(error);
      setApiAvailable(false);
      setDrones([]);
      setNodes([]);
    } finally {
      setLoading(false);
    }
  };

  const runSimulationCycle = async () => {
    try {
      if (mockEnabled) return;
      const [currentDrones, currentNodes] = await Promise.all([getDrones(), getNodes()]);
      await runSimulation(currentDrones, currentNodes);
    } catch (error) {
      console.error('Simulation error:', error);
    }
  };

  const getBatteryBarColor = (battery: number) => {
    if (battery > 60) return 'bg-emerald-500';
    if (battery > 30) return 'bg-amber-500';
        return 'bg-rose-500';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      idle: { label: 'Idle', className: 'bg-muted text-foreground' },
      flying: { label: 'Flying', className: 'bg-primary text-primary-foreground shadow-sm' },
      charging: { label: 'Charging', className: 'bg-amber-500 text-white shadow-sm' },
      en_route: { label: 'En Route', className: 'bg-sky-600 text-white shadow-sm' },
    };
    const config = variants[status] || variants.idle;
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };
  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Local Cluster Monitoring</h1>
            <p className="text-muted-foreground">Real-time drone fleet monitoring</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {mockEnabled && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                ML Mock Mode
              </Badge>
            )}
            {mockEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOverlays((prev) => !prev)}
              >
                {showOverlays ? 'Hide ML Overlays' : 'Show ML Overlays'}
              </Button>
            )}
            {!mockEnabled && (
              <>
                <Activity className="h-4 w-4 animate-pulse text-primary" />
                <span>Live Updates</span>
              </>
            )}
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
              <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                <div ref={mapRef} className="absolute inset-0" />
                {!leafletReady && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Leaflet failed to load. Check the script include in index.html.
                  </div>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{displayDrones.length}</div>
                  <div className="text-xs text-muted-foreground">Total Drones</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-secondary">{displayNodes.length}</div>
                  <div className="text-xs text-muted-foreground">Charging Nodes</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-chart-5">
                    {displayDrones.filter((d) => d.status === 'flying').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Active Flights</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-chart-4">
                    {displayDrones.filter((d) => d.status === 'charging').length}
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
              <div className="space-y-3 max-h-[520px] overflow-y-auto">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full bg-muted" />
                  ))
                ) : (
                  displayDrones.map((drone) => (
                    <div
                      key={drone.id}
                      className="p-4 border border-border rounded-xl bg-background shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-sm">{drone.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {drone.company?.name || 'Unknown'}
                          </div>
                        </div>
                        {getStatusBadge(drone.status)}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="h-4 w-4 rounded-sm border-2 border-emerald-500" />
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${getBatteryBarColor(drone.battery)}`}
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
                displayNodes.map((node) => (
                  <div key={node.id} className="p-4 border border-border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">{node.name}</div>
                        <div className="text-xs text-muted-foreground">Platform-owned</div>
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
