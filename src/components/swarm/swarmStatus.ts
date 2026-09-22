import InfoClass from "../appstate/classes/InfoClass";
import FetchErrorClass from "../appstate/classes/FetchErrorClass";
import { SyncStatusType } from "../appstate/types/SyncStatusType";

/**
 * What the wallet's connection looks like, said in words a person can act on.
 *
 * The old sidebar printed the wallet's own machinery: a `SYNCING` label beside
 * a raw percentage, and, when the indexer went missing, the whole failure as
 * it arrived —
 *
 *   sync: Indexer request error. ← code: 'The service is currently
 *   unavailable', message: "dns error", source: tonic::transport::Error(...)
 *
 * Four layers of transport plumbing describing one fact: the computer could
 * not find the server. That fact is worth a sentence; the layers are worth a
 * disclosure triangle, which is where `technical` goes.
 *
 * Everything here is a pure function of state the app already holds, so the
 * wording is testable without a wallet, a server, or a render.
 */

/** The three states a person needs to tell apart. */
export type SwarmConnectionState = "synced" | "syncing" | "disconnected";

export type SwarmStatus = {
  state: SwarmConnectionState;
  /** Short form for the chip: "Synced", "Syncing 42 %", "Not connected". */
  label: string;
  /** The line under it: block height and server, or why there is neither. */
  detail: string;
  /** Whole percent when one is known, else null. */
  percent: number | null;
  /** Host of the configured server, for anything that needs to name it. */
  host: string;
};

/**
 * The host a server URI points at, with the scheme, port and path removed.
 *
 * Shown instead of the full URI because the host is the part a person can
 * recognise, and instead of a peer count because a light wallet has no peers:
 * it talks to exactly one indexer and knows nothing about the network beyond
 * what that indexer tells it.
 */
export function serverHost(serverUri: string | undefined): string {
  if (!serverUri) return "";
  const trimmed = serverUri.trim();
  if (!trimmed) return "";
  try {
    // `new URL` needs a scheme; a bare "host:port" is common in settings.
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const { hostname } = new URL(withScheme);
    return hostname || trimmed;
  } catch {
    return trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split(/[/:?#]/)[0] || trimmed;
  }
}

/** A block height with thousands separators: 812405 -> "812,405". */
export function formatHeight(height: number): string {
  if (!Number.isFinite(height) || height <= 0) return "—";
  return Math.floor(height).toLocaleString("en-US");
}

/**
 * The connection state, from the same three signals the old sidebar read.
 *
 * `latestBlock` is what the server last told us; `verificationProgress` is how
 * much of the chain this wallet has scanned. No server block means nothing has
 * answered, which is "not connected" whatever the wallet has scanned before.
 */
export function deriveStatus(
  info: InfoClass,
  verificationProgress: number | null,
  syncingStatus?: SyncStatusType,
): SwarmStatus {
  const host = serverHost(info?.serverUri);
  const height = info?.latestBlock ?? 0;

  if (!height) {
    return {
      state: "disconnected",
      label: "Not connected",
      detail: host ? `No answer from ${host}` : "No server configured",
      percent: null,
      host,
    };
  }

  // A percentage can arrive from either the verification pass or the scanner.
  const scanned = syncingStatus?.percentage_total_blocks_scanned;
  const raw = verificationProgress ?? (typeof scanned === "number" ? scanned : null);

  if (raw !== null && raw < 100) {
    const percent = Math.max(0, Math.min(99, Math.floor(raw)));
    return {
      state: "syncing",
      label: `Syncing ${percent} %`,
      detail: `${formatHeight(height)} · ${host}`,
      percent,
      host,
    };
  }

  if (raw === null) {
    // Connected enough to have a height, not far enough to have measured
    // progress. Still "syncing" to a person: the number on screen is moving.
    return {
      state: "syncing",
      label: "Syncing…",
      detail: `${formatHeight(height)} · ${host}`,
      percent: null,
      host,
    };
  }

  return {
    state: "synced",
    label: "Synced",
    detail: `#${formatHeight(height)} · ${host}`,
    percent: 100,
    host,
  };
}

export type SwarmProblemKind = "unreachable" | "funds" | "wallet" | "unknown";

export type SwarmProblem = {
  kind: SwarmProblemKind;
  /** One sentence naming what went wrong, in the user's terms. */
  headline: string;
  /** What it means for them, and what the app is doing about it. */
  body: string;
  /** Whether offering a Retry button makes sense for this failure. */
  retryable: boolean;
  /** The original text, verbatim, for the "Technical details" expander. */
  technical: string;
};

// Every way the transport says "I could not get to the server". Matched on the
// raw text because that is all that survives the trip across the IPC boundary:
// the typed error is gone by the time the renderer sees it.
const UNREACHABLE = [
  "dns error",
  "no such host",
  "failed to lookup",
  "name resolution",
  "getaddrinfo",
  "service is currently unavailable",
  "tonic::transport",
  "transport error",
  "connection refused",
  "connection reset",
  "connection closed",
  "econnrefused",
  "enotfound",
  "etimedout",
  "timed out",
  "deadline exceeded",
  "network is unreachable",
  "unavailable",
  "could not connect",
  "error trying to connect",
];

const FUNDS = ["insufficient funds", "insufficient balance", "not enough"];

/**
 * A raw failure, turned into something worth reading.
 *
 * Returns null for an empty error so callers can render nothing without
 * having to check twice. `technical` is never rewritten or trimmed: the
 * expander exists precisely so the accurate text stays available, and a
 * summary that quietly edited it would be worse than no summary.
 */
export function plainProblem(raw: string | undefined | null, host?: string): SwarmProblem | null {
  const technical = (raw ?? "").toString();
  if (!technical.trim()) return null;

  const lower = technical.toLowerCase();
  const server = host && host.trim() ? host.trim() : "the wallet server";

  if (UNREACHABLE.some((needle) => lower.includes(needle))) {
    return {
      kind: "unreachable",
      headline: `Can't reach the wallet server ${server} right now.`,
      body: "Your coins are safe. Retrying…",
      retryable: true,
      technical,
    };
  }

  if (FUNDS.some((needle) => lower.includes(needle))) {
    return {
      kind: "funds",
      headline: "Not enough spendable balance for this payment.",
      body: "Coins from a very recent block are still confirming and cannot be spent yet.",
      retryable: false,
      technical,
    };
  }

  if (lower.includes("wallet") || lower.includes("read:") || lower.includes("saving wallet")) {
    return {
      kind: "wallet",
      headline: "The wallet couldn't finish that.",
      body: "Your coins are safe. Try again, and open the details below if it keeps happening.",
      retryable: true,
      technical,
    };
  }

  return {
    kind: "unknown",
    headline: "Something went wrong.",
    body: "Your coins are safe. The exact message is under the details below.",
    retryable: true,
    technical,
  };
}

/**
 * The problem worth showing on the shell, out of everything that can be wrong
 * at once. A failed fetch is the loudest and comes first; a sync error is the
 * quieter background one.
 */
export function currentProblem(
  fetchError: FetchErrorTypeLike | undefined,
  syncingStatus: SyncStatusType | undefined,
  host: string,
): SwarmProblem | null {
  const fetched = fetchError?.error;
  if (fetched) return plainProblem(fetched, host);
  return plainProblem(syncingStatus?.lastError, host);
}

type FetchErrorTypeLike = Pick<FetchErrorClass, "error"> | Record<string, never>;
