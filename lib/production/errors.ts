import { DesignError } from "../services/image-design";
export function jobError(message: string): DesignError {
  if (/JOB_NOT_FOUND|PROJECT_NOT_FOUND/.test(message))
    return new DesignError("This request could not be found.", 404);
  if (/JOB_CONFLICT/.test(message))
    return new DesignError(
      "This request already belongs to a different design. Start a new request.",
      409,
    );
  if (/REQUEST_IN_PROGRESS/.test(message))
    return new DesignError(
      "Another design is still processing. Check your projects before trying again.",
      409,
    );
  if (/ACCOUNT_DELETING/.test(message))
    return new DesignError("Your account deletion is in progress.", 409);
  if (/SHORT_LIMIT|DAILY_LIMIT/.test(message))
    return new DesignError(
      "Your design request limit has been reached. Please try again later.",
      429,
    );
  if (/SERVICE_BUSY/.test(message))
    return new DesignError(
      "Design generation is busy. Please try again shortly.",
      429,
    );
  if (/SERVICE_LIMIT/.test(message))
    return new DesignError(
      "Design generation is at its daily capacity. Your saved projects remain available.",
      429,
    );
  return new DesignError(
    "The request service is unavailable. Your saved projects are unchanged.",
    503,
  );
}
