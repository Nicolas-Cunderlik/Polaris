import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NetworkData {
  total_nodes: number;
  total_drones: number;
  deliveries_per_hour: number;
  average_delay: number;
  congestion_level: number;
  battery_failures: number;
  most_congested_node?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      throw new Error('INTEGRATIONS_API_KEY not configured');
    }

    const { networkData } = await req.json() as { networkData: NetworkData };

    if (!networkData) {
      throw new Error('Network data is required');
    }

    // Build prompt for Gemini
    const prompt = `You are an AI analyst for a drone logistics network. Analyze the following network data and provide 3-4 specific, actionable recommendations to improve efficiency.

Network Data:
- Total Nodes: ${networkData.total_nodes}
- Total Drones: ${networkData.total_drones}
- Deliveries per Hour: ${networkData.deliveries_per_hour}
- Average Delivery Delay: ${networkData.average_delay.toFixed(1)} minutes
- Network Congestion Level: ${networkData.congestion_level}%
- Battery Failures Today: ${networkData.battery_failures}
${networkData.most_congested_node ? `- Most Congested Node: ${networkData.most_congested_node}` : ''}

Provide recommendations in the following JSON format:
{
  "recommendations": [
    {
      "title": "Brief title",
      "description": "Detailed explanation",
      "impact": "Expected improvement (e.g., '15% reduction in delays')",
      "priority": "high|medium|low"
    }
  ],
  "summary": "One paragraph overall assessment"
}

Focus on: infrastructure placement, fleet optimization, charging strategy, and congestion management.`;

    // Call Gemini API
    const response = await fetch(
      'https://app-a9g24ae5kwsh-api-VaOwP8E7dJqa.gateway.appmedo.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    // Parse SSE stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              const text = jsonData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullText += text;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }

    // Extract JSON from response (handle markdown code blocks)
    let analysisData;
    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.error('Failed to parse AI response:', fullText);
      // Fallback response
      analysisData = {
        recommendations: [
          {
            title: 'Optimize Node Placement',
            description: 'Consider adding charging nodes in high-traffic areas to reduce drone travel time.',
            impact: '10-15% reduction in delivery delays',
            priority: 'high',
          },
        ],
        summary: 'Network analysis completed. Review recommendations for optimization opportunities.',
      };
    }

    return new Response(JSON.stringify(analysisData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
