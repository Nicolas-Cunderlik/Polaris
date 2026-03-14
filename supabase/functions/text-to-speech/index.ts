const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('INTEGRATIONS_API_KEY');
    if (!apiKey) {
      throw new Error('INTEGRATIONS_API_KEY not configured');
    }

    const { text } = await req.json() as { text: string };

    if (!text) {
      throw new Error('Text is required');
    }

    // Call Text-to-Speech API
    const response = await fetch(
      'https://app-a9g24ae5kwsh-api-GYX1lzGw01Xa.gateway.appmedo.com/v1/audio/speech',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          voice: 'heart',
          response_format: 'mp3',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API error:', errorText);
      throw new Error(`TTS API error: ${response.status}`);
    }

    // Return audio as binary
    const audioData = await response.arrayBuffer();

    return new Response(audioData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream',
      },
    });
  } catch (error) {
    console.error('Error in text-to-speech function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
