import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---- VAPID helpers ----

function b64urlToUint8(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function buildVapidJwt(audience: string, vapidPrivateKeyB64: string, vapidPublicKeyB64: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: "mailto:no-reply@alojetk.com",
  };

  const encoder = new TextEncoder();
  const toSign = `${uint8ToB64url(encoder.encode(JSON.stringify(header)))}.${uint8ToB64url(encoder.encode(JSON.stringify(payload)))}`;

  const privKeyBytes = b64urlToUint8(vapidPrivateKeyB64);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    privKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    encoder.encode(toSign)
  );

  return `${toSign}.${uint8ToB64url(new Uint8Array(sig))}`;
}

// Encrypt a web push payload using AES-128-GCM + ECDH (RFC 8291)
async function encryptPayload(
  plaintext: string,
  p256dhB64: string,
  authB64: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(plaintext);

  // Client public key (receiver)
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    b64urlToUint8(p256dhB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Generate ephemeral server key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));

  // ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );

  const authSecret = b64urlToUint8(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF for pseudo-random key
  const ikm = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);

  // PRK_key = HKDF-Extract(auth_secret, ecdh_secret) with info = "WebPush: info\0" + client_pub + server_pub
  const info = new Uint8Array([
    ...encoder.encode("WebPush: info\0"),
    ...b64urlToUint8(p256dhB64),
    ...serverPublicKeyRaw,
  ]);

  const prk = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: authSecret, info }, ikm, 256);

  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);

  // Content encryption key
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const cekBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: cekInfo }, prkKey, 128);

  // Nonce
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonceBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, prkKey, 96);

  const cekKey = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM", length: 128 }, false, ["encrypt"]);

  // RFC 8291 padding: payload + \x02 delimiter (minimum record size)
  const padded = new Uint8Array(plainBytes.length + 1);
  padded.set(plainBytes, 0);
  padded[plainBytes.length] = 2; // \x02 delimiter

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(nonceBits), tagLength: 128 },
    cekKey,
    padded
  );

  // Build aes128gcm content (RFC 8188)
  // Header: salt(16) + rs(4) + keyid_len(1) + keyid(65)
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKeyRaw.length);
  header.set(salt, 0);
  header[16] = (rs >> 24) & 0xff;
  header[17] = (rs >> 16) & 0xff;
  header[18] = (rs >> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = serverPublicKeyRaw.length;
  header.set(serverPublicKeyRaw, 21);

  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = new Uint8Array(header.length + encryptedBytes.length);
  ciphertext.set(header, 0);
  ciphertext.set(encryptedBytes, header.length);

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await buildVapidJwt(audience, vapidPrivateKey, vapidPublicKey);

    const { ciphertext } = await encryptPayload(
      JSON.stringify(payload),
      subscription.p256dh,
      subscription.auth
    );

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt},k=${vapidPublicKey}`,
      },
      body: ciphertext,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, statusCode: res.status, error: text };
    }
    return { success: true, statusCode: res.status };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // These are the VAPID keys generated for this project.
    // Must match VITE_VAPID_PUBLIC_KEY in the frontend .env
    const VAPID_PUBLIC = "BPSLm-2BDxeKlt7e24nCn7Yj1yDRzRDYldVMyDS5780YHmYkrHq0wt2mA4uh4PkZCjy2gfywyrM2lw9L6BGJ5-I";
    const VAPID_PRIVATE = "DRdH1w1XjhJk31JCSznBbsLZ-5UBoUrRJhytVbE_WGo";

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || VAPID_PUBLIC;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || VAPID_PRIVATE;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let title = "طلب جديد!";
    let body = "يوجد طلب جديد في قائمة الانتظار";
    let extraData: Record<string, string> = { type: "new_order" };

    try {
      const payload = await req.json();
      if (payload.title) title = payload.title;
      if (payload.body) body = payload.body;
      if (payload.data) {
        for (const [k, v] of Object.entries(payload.data)) {
          extraData[k] = typeof v === "string" ? v : JSON.stringify(v);
        }
      }
      if (payload.order_id) extraData.order_id = String(payload.order_id);
      if (payload.order_number) extraData.order_number = String(payload.order_number);
    } catch {
      // use defaults
    }

    const { data: subs, error: subsError } = await supabase
      .from("web_push_subscriptions")
      .select("id, driver_id, endpoint, p256dh, auth")
      .eq("is_active", true);

    if (subsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions", details: subsError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active web push subscriptions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notification = { title, body, data: extraData };
    let sent = 0;
    let failed = 0;
    const expiredIds: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          notification,
          vapidPublicKey,
          vapidPrivateKey
        );

        if (result.success) {
          sent++;
        } else {
          failed++;
          console.error(`Web push failed for driver ${sub.driver_id}: ${result.error} (${result.statusCode})`);
          // 404 or 410 = subscription expired/unsubscribed
          if (result.statusCode === 404 || result.statusCode === 410) {
            expiredIds.push(sub.id);
          }
        }
      })
    );

    if (expiredIds.length > 0) {
      await supabase
        .from("web_push_subscriptions")
        .update({ is_active: false })
        .in("id", expiredIds);
    }

    console.log(`Web push: ${sent} sent, ${failed} failed out of ${subs.length}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: subs.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-drivers-web-push:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
