import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Validate authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ match: false, confidence: 0, reason: 'Unauthorized', error: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[verify-face] Missing Supabase configuration');
      return new Response(
        JSON.stringify({ match: false, confidence: 0, reason: 'Service configuration error', error: 'CONFIG_ERROR' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('[verify-face] Authentication failed:', claimsError?.message);
      return new Response(
        JSON.stringify({ match: false, confidence: 0, reason: 'Unauthorized', error: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('[verify-face] Authenticated user:', userId);

    const { enrolledImageUrl, capturedImageBase64 } = await req.json();

    console.log('[verify-face] request received', {
      hasEnrolled: !!enrolledImageUrl,
      hasCaptured: !!capturedImageBase64,
      enrolledPrefix: typeof enrolledImageUrl === 'string' ? enrolledImageUrl.slice(0, 40) : null,
      capturedPrefix: typeof capturedImageBase64 === 'string' ? capturedImageBase64.slice(0, 30) : null,
    });

    if (!enrolledImageUrl || !capturedImageBase64) {
      return new Response(
        JSON.stringify({ match: false, confidence: 0, reason: 'Missing required images', error: 'MISSING_IMAGES' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[verify-face] LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ match: false, confidence: 0, reason: 'Verification unavailable', error: 'SERVICE_ERROR' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-face] Comparing faces...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
{"match": false, "confidence": 0.85, "reason": "Brief explanation"}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Compare these two face images. First is the enrolled/reference face, second is the captured face for verification. Are they the same person?',
              },
              {
                type: 'image_url',
                image_url: { url: enrolledImageUrl },
              },
              {
                type: 'image_url',
                image_url: { url: capturedImageBase64 },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[verify-face] AI API error:', response.status, errorText);

      return new Response(
        JSON.stringify({
          match: false,
          confidence: 0,
          reason: 'Verification failed',
          error: 'SERVICE_ERROR',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    console.log('[verify-face] AI response:', content);

    let result: any = { match: false, confidence: 0, reason: 'Could not parse response', error: 'PARSE_ERROR' };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('[verify-face] Failed to parse AI response:', parseError);
    }

    // Normalize output so the client can rely on shape
    const normalized = {
      match: !!result.match,
      confidence: typeof result.confidence === 'number' ? result.confidence : 0,
      reason: typeof result.reason === 'string' ? result.reason : (result.match ? 'Matched' : 'Not matched'),
    };

    console.log('[verify-face] Result:', normalized);

    return new Response(JSON.stringify(normalized), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[verify-face] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ match: false, confidence: 0, reason: message, error: 'SERVER_ERROR' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
