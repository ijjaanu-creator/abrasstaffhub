import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { enrolledImageUrl, capturedImageBase64 } = await req.json();

    if (!enrolledImageUrl || !capturedImageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing required images', match: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured', match: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-face] Comparing faces...');

    // Use Lovable AI (Gemini) to compare the two faces
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a face verification system. Compare the two face images provided and determine if they show the SAME person.

Rules:
- Focus on facial features: eyes, nose, mouth, face shape, ears
- Account for lighting differences, angles, and expressions
- Be reasonably strict - the faces should clearly be the same person
- Respond with ONLY a JSON object, no other text

Response format:
{"match": true, "confidence": 0.95, "reason": "Brief explanation"}
or
{"match": false, "confidence": 0.85, "reason": "Brief explanation"}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Compare these two face images. First is the enrolled/reference face, second is the captured face for verification. Are they the same person?'
              },
              {
                type: 'image_url',
                image_url: { url: enrolledImageUrl }
              },
              {
                type: 'image_url',
                image_url: { url: capturedImageBase64 }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[verify-face] AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later', match: false }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted, please contact admin', match: false }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Face verification failed', match: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('[verify-face] AI response:', content);

    // Parse the AI response
    let result = { match: false, confidence: 0, reason: 'Could not parse response' };
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('[verify-face] Failed to parse AI response:', parseError);
    }

    console.log('[verify-face] Result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[verify-face] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message, match: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
