import { createPrivateKey, sign, randomUUID } from "node:crypto";
import { DesignError } from "../services/image-design";
import { deviceCheckReason } from "./device-check-response";
export function starterConfigured() {
  return (
    process.env.STARTER_TOKENS_ENABLED === "true" &&
    !!process.env.APPLE_DEVICECHECK_PRIVATE_KEY &&
    /^[A-Z0-9]{10}$/.test(process.env.APPLE_DEVICECHECK_KEY_ID?.trim() || "") &&
    (process.env.STARTER_TOKEN_HASH_KEY?.length || 0) >= 32
  );
}
type Stage = "configuration" | "query_two_bits" | "update_two_bits";
// Log controlled labels only. Device tokens, authorization headers and response
// bodies must never enter diagnostics.
function diagnostic(stage: Stage, reason: string, status?: number) {
  console.warn("siteai_starter_device_check", {
    stage,
    reason,
    ...(status ? { status } : {}),
  });
}
export function deviceCheckClient(request: typeof fetch = fetch) {
  const kid = process.env.APPLE_DEVICECHECK_KEY_ID?.trim();
  const pem = process.env.APPLE_DEVICECHECK_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const team = process.env.APPLE_SIGN_IN_TEAM_ID || "47LP6F2JXD";
  const fail = () =>
    new DesignError(
      "The starter token check could not finish. Please try again shortly.",
      503,
      "starter_unavailable",
    );
  if (!kid || !pem || !/^[A-Z0-9]{10}$/.test(kid)) {
    diagnostic("configuration", "missing_key");
    throw fail();
  }
  let key;
  try {
    key = createPrivateKey(pem);
    if (
      key.asymmetricKeyType !== "ec" ||
      key.asymmetricKeyDetails?.namedCurve !== "prime256v1"
    )
      throw fail();
  } catch {
    diagnostic("configuration", "invalid_private_key");
    throw fail();
  }
  const enc = (x: object) =>
    Buffer.from(JSON.stringify(x)).toString("base64url");
  const message = `${enc({ alg: "ES256", kid, typ: "JWT" })}.${enc({ iss: team, iat: Math.floor(Date.now() / 1000) })}`;
  const jwt = `${message}.${sign("sha256", Buffer.from(message), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  const signal = AbortSignal.timeout(25_000);
  async function post(
    path: Exclude<Stage, "configuration">,
    token: string,
    values = {},
  ) {
    let response: Response;
    try {
      response = await request("https://api.devicecheck.apple.com/v1/" + path, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal,
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_token: token,
          transaction_id: randomUUID(),
          timestamp: Date.now(),
          ...values,
        }),
      });
    } catch {
      diagnostic(path, signal.aborted ? "timeout" : "network_failure");
      throw fail();
    }
    let text: string;
    try {
      text = await response.text();
    } catch {
      diagnostic(path, "response_read_failed", response.status);
      throw fail();
    }
    if (!response.ok) {
      diagnostic(path, deviceCheckReason(text), response.status);
      throw fail();
    }
    return text;
  }
  return {
    async used(token: string) {
      const text = await post("query_two_bits", token);
      if (deviceCheckReason(text) === "bit_state_not_found") return false;
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        diagnostic("query_two_bits", "invalid_json", 200);
        throw fail();
      }
      if (!data || typeof data.bit0 !== "boolean") {
        diagnostic("query_two_bits", "invalid_bit_state", 200);
        throw fail();
      }
      return data.bit0;
    },
    async markUsed(token: string) {
      // Bit 0 is reserved for Site AI's starter offer. Leave the developer's bit 1 unchanged.
      await post("update_two_bits", token, { bit0: true });
    },
  };
}
