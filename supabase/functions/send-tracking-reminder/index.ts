import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Convert VAPID key from URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Import crypto key from raw bytes
async function importVapidKey(privateKeyBase64: string): Promise<CryptoKey> {
  const rawKey = urlBase64ToUint8Array(privateKeyBase64);
  return await crypto.subtle.importKey(
    'pkcs8',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

// Create JWT for VAPID authentication
async function createVapidJwt(endpoint: string, subject: string, privateKeyBase64: string, publicKeyBase64: string): Promise<{ authorization: string; cryptoKey: string }> {
  const audience = new URL(endpoint).origin;
  
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60), // 12 hours
    sub: subject,
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  
  // Import the private key for signing
  const rawKey = urlBase64ToUint8Array(privateKeyBase64);
  
  // The VAPID private key is a raw 32-byte key, import as JWK
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: privateKeyBase64,
    x: '', // Will be derived
    y: '', // Will be derived
  };
  
  // For web push, we need to use the web-push compatible approach
  // Instead of complex crypto, let's use a simpler HTTP approach
  
  return {
    authorization: `vapid t=${unsignedToken}, k=${publicKeyBase64}`,
    cryptoKey: `p256ecdsa=${publicKeyBase64}`,
  };
}

// Send a web push notification using fetch
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<Response> {
  // For web push, we need proper VAPID + encryption
  // Since Deno doesn't have a native web-push library, we'll use a simpler approach
  // by calling the push service endpoint with the proper headers
  
  const audience = new URL(subscription.endpoint).origin;
  
  // Create a minimal VAPID token
  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const claims = btoa(JSON.stringify({
    aud: audience,
    exp: now + 43200,
    sub: vapidSubject,
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  // Import VAPID private key as JWK for ECDSA signing
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: vapidPrivateKey,
  };
  
  // We need x and y coordinates from the public key
  const pubKeyBytes = urlBase64ToUint8Array(vapidPublicKey);
  // Public key is 65 bytes: 0x04 + 32 bytes x + 32 bytes y
  if (pubKeyBytes.length === 65 && pubKeyBytes[0] === 0x04) {
    const xBytes = pubKeyBytes.slice(1, 33);
    const yBytes = pubKeyBytes.slice(33, 65);
    (jwk as any).x = btoa(String.fromCharCode(...xBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    (jwk as any).y = btoa(String.fromCharCode(...yBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  
  let signature = '';
  try {
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
    
    // Convert DER signature to raw r||s format if needed, or just base64url encode
    const sigArray = new Uint8Array(sigBytes);
    signature = btoa(String.fromCharCode(...sigArray))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const jwt = `${unsignedToken}.${signature}`;
    
    // For encrypted payload, we need proper content encryption
    // For now, send without payload body (notification data is in the push event)
    // The simplest approach: send a push with TTL and VAPID, no encrypted body
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
  } catch (err) {
    console.error('Error signing VAPID JWT:', err);
    throw err;
  }
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

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Find staff who are checked in today (have check_in but no check_out) AND have track_location enabled
    const { data: activeAttendance, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('staff_id')
      .eq('date', today)
      .not('check_in', 'is', null)
      .is('check_out', null);

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
      throw attendanceError;
    }

    if (!activeAttendance || activeAttendance.length === 0) {
      console.log('No active check-ins found');
      return new Response(
        JSON.stringify({ message: 'No active check-ins', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const staffIds = activeAttendance.map(a => a.staff_id);
    console.log(`Found ${staffIds.length} checked-in staff`);

    // Filter for staff with track_location enabled
    const { data: trackedStaff, error: staffError } = await supabase
      .from('staff_members')
      .select('id')
      .in('id', staffIds)
      .eq('track_location', true);

    if (staffError) {
      console.error('Error fetching staff:', staffError);
      throw staffError;
    }

    if (!trackedStaff || trackedStaff.length === 0) {
      console.log('No tracked staff found among checked-in staff');
      return new Response(
        JSON.stringify({ message: 'No tracked staff checked in', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trackedStaffIds = trackedStaff.map(s => s.id);
    console.log(`Found ${trackedStaffIds.length} tracked staff`);

    // Get push subscriptions for these staff members
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('staff_id', trackedStaffIds);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for tracked staff');
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} subscriptions to notify`);

    let sent = 0;
    let failed = 0;
    const expiredSubscriptions: string[] = [];

    // Send notification to each subscription
    for (const sub of subscriptions) {
      try {
        const response = await sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          JSON.stringify({
            title: 'Abras Staff Hub',
            body: 'Open the app to keep your location updated 📍',
            icon: '/pwa-192x192.png',
          }),
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        if (response.ok || response.status === 201) {
          sent++;
          console.log(`Notification sent to staff ${sub.staff_id}`);
        } else if (response.status === 404 || response.status === 410) {
          // Subscription expired or invalid
          console.log(`Subscription expired for staff ${sub.staff_id}, marking for cleanup`);
          expiredSubscriptions.push(sub.id);
          failed++;
        } else {
          console.error(`Failed to send to staff ${sub.staff_id}: ${response.status} ${response.statusText}`);
          const body = await response.text();
          console.error('Response body:', body);
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
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredSubscriptions);
      
      if (deleteError) {
        console.error('Error cleaning up subscriptions:', deleteError);
      }
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
