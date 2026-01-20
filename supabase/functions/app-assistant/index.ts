import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the Abras Staff Hub AI Assistant. You help staff members understand and use the attendance and payroll management app.

About the App:
- Abras Staff Hub is a staff attendance and payroll management system
- Staff can mark attendance using face verification and geofence location
- Staff can view their attendance history in "My Attendance" page
- Staff can view salary details in "My Salary" page
- Staff can update their profile information in "Profile" page
- Admins can manage staff, view attendance records, and process payroll

Key Features:
1. **Mark Attendance**: Use facial recognition to check-in/check-out. Must be within the office geofence area.
2. **My Attendance**: View your attendance history, check-in/out times, and work hours.
3. **My Salary**: View monthly salary details including base salary, bonuses, deductions, and advances.
4. **Profile**: Update your personal information and view your employee details.
5. **Chat with Admin**: Send private messages to admins for any queries or issues.

Common Questions:
- For attendance issues: Check if you're within the office area and have good GPS signal
- For salary queries: Contact admin through the chat feature
- For face verification issues: Request face re-registration from your profile

Always be helpful, concise, and friendly. If you don't know something specific about the user's data, suggest they check the relevant page or contact admin.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("App assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
