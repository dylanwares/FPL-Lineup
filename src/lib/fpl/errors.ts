import { FetchJsonError } from "@/lib/fetch-json";
import { TeamImportError } from "./build-import";

/**
 * The upstream HTTP status of a failed FPL request. Errors thrown inside a
 * `use cache` function cross a serialisation boundary and arrive as plain
 * Errors (class lost, message kept), so fall back to the message.
 */
function upstreamStatus(err: unknown): number | undefined {
  if (err instanceof FetchJsonError) return err.status;
  if (err instanceof Error && err.name === "FetchJsonError") {
    const m = /failed with (\d{3})$/.exec(err.message);
    return m ? Number(m[1]) : undefined;
  }
  return undefined;
}

/** Turns FPL/import failures into a JSON error response with a message fit for users. */
export function fplErrorResponse(err: unknown): Response {
  if (err instanceof TeamImportError) return Response.json({ error: err.message }, { status: err.status });
  const status = upstreamStatus(err);
  if (status === 404) {
    return Response.json({ error: "No FPL team found with that ID." }, { status: 404 });
  }
  if (status === 503) {
    return Response.json(
      { error: "FPL is updating right now. Try again in a few minutes." },
      { status: 503 },
    );
  }
  console.error("[fpl] request failed", err);
  return Response.json({ error: "Couldn't reach FPL. Try again shortly." }, { status: 502 });
}

/** Parses a route's entry id: digits only, within FPL's range. */
export function parseEntryId(raw: string): number | null {
  if (!/^\d{1,10}$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}
