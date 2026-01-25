import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let emailData: {
    user: { email: string };
    email_data: {
      token: string;
      token_hash: string;
      redirect_to: string;
      email_action_type: string;
    };
  };

  // Verify webhook signature if secret is set
  if (hookSecret) {
    try {
      const wh = new Webhook(hookSecret);
      emailData = wh.verify(payload, headers) as typeof emailData;
    } catch (error) {
      console.error("Webhook verification failed:", error);
      return new Response(
        JSON.stringify({ error: { http_code: 401, message: "Invalid signature" } }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  } else {
    emailData = JSON.parse(payload);
  }

  const { user, email_data } = emailData;
  const { token, email_action_type } = email_data;

  console.log(`Processing ${email_action_type} email for ${user.email}`);
  console.log(`OTP Token: ${token}`);

  let subject = "";
  let htmlContent = "";

  switch (email_action_type) {
    case "signup":
      subject = "Verify your email - Abras Staff Hub";
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">Abras Staff Hub</h1>
            <p style="color: #666; margin-top: 5px;">Natural Spices</p>
          </div>
          <h2 style="color: #333;">Verify your email</h2>
          <p style="color: #666; font-size: 16px;">Use the code below to verify your email address:</p>
          <div style="background: #f4f4f4; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">${token}</span>
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `;
      break;

    case "magiclink":
    case "email":
      subject = "Your login code - Abras Staff Hub";
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">Abras Staff Hub</h1>
            <p style="color: #666; margin-top: 5px;">Natural Spices</p>
          </div>
          <h2 style="color: #333;">Your login code</h2>
          <p style="color: #666; font-size: 16px;">Enter this 6-digit code to sign in:</p>
          <div style="background: #f4f4f4; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">${token}</span>
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `;
      break;

    case "recovery":
      subject = "Reset your password - Abras Staff Hub";
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">Abras Staff Hub</h1>
            <p style="color: #666; margin-top: 5px;">Natural Spices</p>
          </div>
          <h2 style="color: #333;">Reset your password</h2>
          <p style="color: #666; font-size: 16px;">Use this code to reset your password:</p>
          <div style="background: #f4f4f4; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">${token}</span>
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `;
      break;

    default:
      subject = "Your verification code - Abras Staff Hub";
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">Abras Staff Hub</h1>
            <p style="color: #666; margin-top: 5px;">Natural Spices</p>
          </div>
          <h2 style="color: #333;">Your verification code</h2>
          <p style="color: #666; font-size: 16px;">Use this code to complete your action:</p>
          <div style="background: #f4f4f4; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">${token}</span>
          </div>
          <p style="color: #999; font-size: 14px;">This code expires in 1 hour.</p>
        </div>
      `;
  }

  try {
    const { error } = await resend.emails.send({
      from: "Abras Staff Hub <noreply@resend.dev>",
      to: [user.email],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      throw error;
    }

    console.log(`Email sent successfully to ${user.email}`);
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: error.message } }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
