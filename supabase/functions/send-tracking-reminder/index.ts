import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Send a web push notification
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<Response> {
  const audience = new URL(subscription.endpoint).origin;
  
  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const claims = btoa(JSON.stringify({
    aud: audience,
    exp: now + 43200,
    sub: vapidSubject,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  // Build JWK from VAPID keys
  const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
  const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const pubKeyBytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    pubKeyBytes[i] = rawData.charCodeAt(i);
  }
  
  const jwk: any = {
    kty: 'EC',
    crv: 'P-256',
    d: vapidPrivateKey,
  };
  
  // Public key is 65 bytes: 0x04 + 32 bytes x + 32 bytes y
  if (pubKeyBytes.length === 65 && pubKeyBytes[0] === 0x04) {
    const xBytes = pubKeyBytes.slice(1, 33);
    const yBytes = pubKeyBytes.slice(33, 65);
    jwk.x = btoa(String.fromCharCode(...xBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    jwk.y = btoa(String.fromCharCode(...yBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  const unsignedToken = `${header}.${claims}`;
  const encoder = new TextEncoder();
  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(unsignedToken)
  );
  
  const sigArray = new Uint8Array(sigBytes);
  const signature = btoa(String.fromCharCode(...sigArray))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const jwt = `${unsignedToken}.${signature}`;
  
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'TTL': '86400',
      'Content-Length': '0',
      'Urgency': 'normal',
    },
  });
  
  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting send-tracking-reminder function');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for test mode
    let isTestMode = false;
    let customTitle = 'Abras Staff Hub';
    let customMessage = 'Open the app to keep your location updated 📍';
    
    try {
      const body = await req.json();
      if (body?.test === true) {
        isTestMode = true;
        // Verify admin role if test mode (manual trigger)
        const authHeader = req.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.replace('Bearer ', '');
          const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
          if (claimsError || !claimsData?.user) {
            return new Response(
              JSON.stringify({ error: 'Unauthorized' }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          // Check admin role
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', claimsData.user.id)
            .eq('role', 'admin')
            .maybeSingle();
          
          if (!roleData) {
            return new Response(
              JSON.stringify({ error: 'Admin access required' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        if (body?.title) customTitle = body.title;
        if (body?.message) customMessage = body.message;
        console.log('Test mode: sending to ALL subscriptions');
      }
    } catch {
      // No body or not JSON, continue with normal mode
    }

    let subscriptions;

    if (isTestMode) {
      // Test mode: send to ALL subscriptions
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*');
      
      if (error) throw error;
      subscriptions = data;
    } else {
      // Normal mode: only send to checked-in tracked staff
      const today = new Date().toISOString().split('T')[0];

      const { data: activeAttendance, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('staff_id')
        .eq('date', today)
        .not('check_in', 'is', null)
        .is('check_out', null);

      if (attendanceError) throw attendanceError;

      if (!activeAttendance || activeAttendance.length === 0) {
        console.log('No active check-ins found');
        return new Response(
          JSON.stringify({ message: 'No active check-ins', sent: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const staffIds = activeAttendance.map(a => a.staff_id);

      const { data: trackedStaff, error: staffError } = await supabase
        .from('staff_members')
        .select('id')
        .in('id', staffIds)
        .eq('track_location', true);

      if (staffError) throw staffError;

      if (!trackedStaff || trackedStaff.length === 0) {
        console.log('No tracked staff found among checked-in staff');
        return new Response(
          JSON.stringify({ message: 'No tracked staff checked in', sent: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const trackedStaffIds = trackedStaff.map(s => s.id);

      const { data, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .in('staff_id', trackedStaffIds);

      if (subError) throw subError;
      subscriptions = data;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions to notify`);

    let sent = 0;
    let failed = 0;
    const expiredSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        const response = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        if (response.ok || response.status === 201) {
          sent++;
          console.log(`Notification sent to staff ${sub.staff_id}`);
        } else if (response.status === 404 || response.status === 410) {
          console.log(`Subscription expired for staff ${sub.staff_id}, marking for cleanup`);
          expiredSubscriptions.push(sub.id);
          failed++;
        } else {
          const body = await response.text();
          console.error(`Failed to send to staff ${sub.staff_id}: ${response.status} - ${body}`);
          failed++;
        }
      } catch (err) {
        console.error(`Error sending to staff ${sub.staff_id}:`, err);
        failed++;
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      console.log(`Cleaning up ${expiredSubscriptions.length} expired subscriptions`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredSubscriptions);
    }

    console.log(`Done. Sent: ${sent}, Failed: ${failed}, Cleaned: ${expiredSubscriptions.length}`);

    return new Response(
      JSON.stringify({ 
        message: 'Reminders processed',
        sent, 
        failed, 
        cleaned: expiredSubscriptions.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-tracking-reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
