/** Normalize only known Apple reason labels. Never expose arbitrary response text. */
export function deviceCheckReason(text: string) {
  let value: unknown = text.trim();
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "string") value = parsed;
    else if (
      parsed &&
      typeof parsed === "object" &&
      "reason" in parsed &&
      !("bit0" in parsed)
    )
      value = parsed.reason;
  } catch {
    /* DeviceCheck also sends plain-text reason labels. */
  }
  if (typeof value !== "string") return "unrecognized_response";
  switch (value.replace(/\s/g, "")) {
    case "BadDeviceToken":
    case "Missingorincorrectlyformatteddevicetokenpayload":
      return "bad_device_token";
    case "InvalidAuthorizationToken":
    case "BadAuthorizationToken":
    case "Unabletoverifyauthorizationtoken":
      return "invalid_authorization";
    case "AuthorizationTokenExpired":
    case "TokenExpired":
      return "authorization_expired";
    case "Forbidden":
      return "forbidden";
    case "BadTimestamp":
      return "bad_timestamp";
    case "BadBits":
      return "bad_bits";
    case "BadTransactionId":
      return "bad_transaction_id";
    case "TooManyRequests":
      return "rate_limited";
    case "BitStateNotFound":
    // Apple's first-query response differs from the table's reason label.
    // https://github.com/PepperHQ/ios-device-check/issues/15
    case "Failedtofindbitstate":
      return "bit_state_not_found";
    default:
      return "unrecognized_response";
  }
}
