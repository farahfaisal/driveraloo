import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const b64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const toSign = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const keyData = pemToArrayBuffer(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(toSign));
  const jwt = `${toSign}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenResponse = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenJson = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(`OAuth token error: ${JSON.stringify(tokenJson)}`);

  cachedToken = { token: tokenJson.access_token, expiresAt: now + (tokenJson.expires_in || 3600) };
  return cachedToken.token;
}

async function sendFcmToToken(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const message = {
    message: {
      token: fcmToken,
      notification: { title, body },
      data,
      android: {
        priority: "HIGH",
        notification: { sound: "default", channel_id: "orders" },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: "default", badge: 1, "content-available": 1 } },
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(message),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    return { success: false, error: JSON.stringify(err) };
  }
  return { success: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountRaw) {
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountRaw);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // قراءة البيانات من الطلب (إذا أُرسلت مباشرة من trigger)
    let title = "طلب جديد!";
    let body = "يوجد طلب جديد في قائمة الانتظار";
    let notificationData: Record<string, string> = { type: "new_order" };

    try {
      const payload = await req.json();
      if (payload.title) title = payload.title;
      if (payload.body) body = payload.body;
      if (payload.data) {
        for (const [k, v] of Object.entries(payload.data)) {
          notificationData[k] = typeof v === "string" ? v : JSON.stringify(v);
        }
      }
      if (payload.order_id) notificationData.order_id = String(payload.order_id);
      if (payload.order_number) notificationData.order_number = String(payload.order_number);
    } catch {
      // لا يوجد body - استخدام القيم الافتراضية
    }

    // جلب جميع FCM tokens للسائقين النشطين
    const { data: tokensData, error: tokensError } = await supabase
      .from("driver_fcm_tokens")
      .select("fcm_token, driver_id")
      .eq("is_active", true)
      .not("fcm_token", "is", null);

    if (tokensError) {
      console.error("Error fetching FCM tokens:", tokensError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch FCM tokens", details: tokensError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokensData || tokensData.length === 0) {
      console.log("No active FCM tokens found");
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active drivers" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(serviceAccount);
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    // إرسال لكل سائق
    await Promise.all(
      tokensData.map(async ({ fcm_token, driver_id }) => {
        const result = await sendFcmToToken(
          accessToken,
          serviceAccount.project_id,
          fcm_token,
          title,
          body,
          notificationData
        );

        if (result.success) {
          sent++;
        } else {
          failed++;
          console.error(`FCM failed for driver ${driver_id}:`, result.error);
          // تعطيل التوكن إذا كان غير صالح
          if (result.error?.includes("UNREGISTERED") || result.error?.includes("INVALID_ARGUMENT")) {
            invalidTokens.push(fcm_token);
          }
        }
      })
    );

    // تعطيل التوكنات غير الصالحة
    if (invalidTokens.length > 0) {
      await supabase
        .from("driver_fcm_tokens")
        .update({ is_active: false })
        .in("fcm_token", invalidTokens);
    }

    console.log(`FCM notifications: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: tokensData.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-drivers-fcm:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
