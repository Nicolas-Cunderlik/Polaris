import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { generateAIAnalysis, generateVoiceExplanation, getNetworkMetrics, getNodes } from '@/db/api';
import type { NetworkMetrics } from '@/types/database';
import { BarChart3, TrendingUp, AlertTriangle, Zap, Volume2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useAuth } from '@/contexts/AuthContext';

interface AIRecommendation {
  title: string;
  description: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
}

interface AIAnalysis {
  recommendations: AIRecommendation[];
  summary: string;
}

const AnalyticsDashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const data = await getNetworkMetrics();
      setMetrics(data);
    } catch (error) {
      toast.error('Failed to load metrics');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAIAnalysis = async () => {
    if (!metrics) return;

    setAiLoading(true);
    try {
      const nodes = await getNodes();
      const mostCongestedNode =
        nodes.length > 0
          ? nodes.reduce((max, node) => {
              const congestion = node.current_load / node.capacity;
              const maxCongestion = max.current_load / max.capacity;
              return congestion > maxCongestion ? node : max;
            }, nodes[0])
          : null;

      const analysis = await generateAIAnalysis(
        {
          ...metrics,
          most_congested_node: mostCongestedNode?.name,
        },
        { id: profile?.company_id ?? null }
      );

      setAiAnalysis(analysis as AIAnalysis);
      toast.success('AI analysis generated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate AI analysis');
      console.error(error);
    } finally {
      setAiLoading(false);
    }
  };

  const playVoiceExplanation = async () => {
    if (!aiAnalysis) {
      toast.error('Generate AI analysis first');
      return;
    }

    setAudioLoading(true);
    try {
      const text = `${aiAnalysis.summary} Here are the key recommendations: ${aiAnalysis.recommendations
        .map((r, i) => `${i + 1}. ${r.title}: ${r.description}`)
        .join(' ')}`;

      const response = await generateVoiceExplanation(text);

      if (!response.audioBase64) {
        toast.info(response.message || 'Text-to-speech is not configured yet');
        return;
      }

      const byteCharacters = atob(response.audioBase64);
      const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0));
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      void audio.play();
      toast.success('Playing voice explanation');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate voice explanation');
      console.error(error);
    } finally {
      setAudioLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const chartData = metrics
    ? [
        { name: 'Nodes', value: metrics.total_nodes, fill: 'hsl(var(--chart-1))' },
        { name: 'Drones', value: metrics.total_drones, fill: 'hsl(var(--chart-2))' },
        { name: 'Deliveries/hr', value: metrics.deliveries_per_hour, fill: 'hsl(var(--chart-3))' },
        { name: 'Failures', value: metrics.battery_failures, fill: 'hsl(var(--chart-4))' },
      ]
    : [];

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Analytics Dashboard</h1>
            <p className="text-muted-foreground">AI-powered network insights and recommendations</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleGenerateAIAnalysis}
              disabled={aiLoading || loading}
              className="gap-2"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate AI Analysis
            </Button>
            {aiAnalysis && (
              <Button
                onClick={playVoiceExplanation}
                disabled={audioLoading}
                variant="outline"
                className="gap-2"
              >
                {audioLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                Voice Explanation
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 bg-muted" />)
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{metrics?.total_nodes}</div>
                  <p className="text-xs text-muted-foreground mt-1">Charging nodes</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Fleet Size
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-secondary">{metrics?.total_drones}</div>
                  <p className="text-xs text-muted-foreground mt-1">Active drones</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Deliveries/Hour
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-chart-5">
                    {metrics?.deliveries_per_hour}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Average throughput</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Delay
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-chart-4">
                    {metrics?.average_delay.toFixed(1)}m
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Delivery delay</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Network Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full bg-muted" />
              ) : (
                <ChartContainer
                  config={{
                    value: {
                      label: 'Value',
                      color: 'hsl(var(--chart-1))',
                    },
                  }}
                  className="h-64"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Network Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Congestion Level</span>
                  <span className="text-sm font-bold">{metrics?.congestion_level}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${
                      (metrics?.congestion_level || 0) > 70
                        ? 'bg-destructive'
                        : (metrics?.congestion_level || 0) > 40
                          ? 'bg-chart-4'
                          : 'bg-chart-5'
                    }`}
                    style={{ width: `${metrics?.congestion_level}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Battery Failures</span>
                  <Badge variant={metrics?.battery_failures === 0 ? 'outline' : 'destructive'}>
                    {metrics?.battery_failures}
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">System Status</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(metrics?.congestion_level || 0) < 50 && (metrics?.battery_failures || 0) === 0
                        ? 'All systems operational'
                        : 'Attention required - check recommendations'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {aiAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Recommendations
              </CardTitle>
              <CardDescription>{aiAnalysis.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiAnalysis.recommendations.map((rec, index) => (
                  <div key={index} className="p-4 border border-border rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="font-medium">{rec.title}</div>
                      <Badge variant={getPriorityColor(rec.priority)}>{rec.priority}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <TrendingUp className="h-3 w-3 text-chart-5" />
                      <span className="text-muted-foreground">{rec.impact}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default AnalyticsDashboardPage;
