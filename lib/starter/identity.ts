import { createHmac } from "node:crypto";
import type { User } from "@supabase/supabase-js";
export function canonicalStarterEmail(email: string) {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) throw Error("Verified email required");
  const base = local.split("+")[0];
  return domain === "gmail.com" || domain === "googlemail.com"
    ? `${base.replaceAll(".", "")}@gmail.com`
    : `${base}@${domain}`;
}
export function starterIdentity(user: User, key: string) {
  if (key.length < 32) throw Error("Starter protection needs a server secret");
  const hash = (value: string) =>
    createHmac("sha256", key).update(value).digest("hex");
  const identities: string[] = [];
  if (user.email && user.email_confirmed_at)
    identities.push(hash("email:" + canonicalStarterEmail(user.email)));
  for (const identity of user.identities || []) {
    const sub = identity.identity_data?.sub;
    if (
      ["apple", "google"].includes(identity.provider) &&
      typeof sub === "string"
    )
      identities.push(hash(`provider:${identity.provider}:${sub}`));
  }
  return {
    account: hash("account:" + user.id),
    identities: [...new Set(identities)].slice(0, 8),
  };
}
