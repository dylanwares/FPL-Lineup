"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PillButton } from "@/components/ui/PillButton";
import { Segmented } from "@/components/ui/Segmented";
import { readPref, writePref } from "@/lib/prefs";
import { appendPage, fetchContent, FILTERS, timeAgo, type ContentFilter } from "./feed";
import type { ContentEntry } from "./model";

const FILTER_KEY = "fpl-lineup:content-filter";
/** Coming back to the tab after this long fetches the newest items again. */
const STALE_MS = 5 * 60_000;

interface Feed {
  items: ContentEntry[];
  nextCursor: string | null;
  loadedAt: number;
}

/** The Content tab: the latest FPL articles and videos, newest first. Each opens at its source in a new tab. */
export function ContentScreen({ active }: { active: boolean }) {
  const [filter, setFilter] = useState<ContentFilter>(() =>
    readPref(
      FILTER_KEY,
      FILTERS.map(([f]) => f),
      "all",
    ),
  );
  // Each filter's feed is kept, so switching back is instant.
  const [feeds, setFeeds] = useState<Partial<Record<ContentFilter, Feed>>>({});
  const [failed, setFailed] = useState(false);
  const inflight = useRef(new Set<string>());
  const feed = feeds[filter];

  /**
   * The newest page (replacing what's shown), or with `before`, the next older
   * one. State only changes once the request settles.
   */
  const load = useCallback((f: ContentFilter, before?: string) => {
    const key = `${f} ${before ?? ""}`;
    if (inflight.current.has(key)) return;
    inflight.current.add(key);
    fetchContent(f, before)
      .then(
        (page) => {
          const loadedAt = Date.now();
          setFeeds((prev) => {
            const old = prev[f];
            return {
              ...prev,
              [f]:
                before && old
                  ? { ...old, items: appendPage(old.items, page.items), nextCursor: page.nextCursor }
                  : { ...page, loadedAt },
            };
          });
          setFailed(false);
        },
        () => setFailed(true),
      )
      .finally(() => inflight.current.delete(key));
  }, []);

  const retry = (before?: string) => {
    setFailed(false);
    load(filter, before);
  };

  // Only fetched once the tab is opened; refreshed when it comes back after a while.
  useEffect(() => {
    if (!active) return;
    const shown = feeds[filter];
    if (!shown || Date.now() - shown.loadedAt > STALE_MS) load(filter);
  }, [active, filter, feeds, load]);

  // Loads the next page as the end of the list scrolls into view.
  const end = useRef<HTMLDivElement>(null);
  const nextCursor = feed?.nextCursor;
  useEffect(() => {
    const el = end.current;
    if (!el || !active || !nextCursor || failed) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) load(filter, nextCursor);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [active, filter, nextCursor, failed, load]);

  return (
    <section aria-labelledby="content-title" className="flex flex-col gap-3 py-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">FPL news & tips</p>
          <h1 id="content-title" className="font-display text-xl font-bold">
            Content
          </h1>
        </div>
        <Segmented
          label="Show"
          value={filter}
          options={FILTERS}
          onChange={(f) => {
            setFilter(f);
            writePref(FILTER_KEY, f);
          }}
        />
      </div>

      {feed ? (
        feed.items.length ? (
          <GlassPanel as="ul" className="divide-y divide-line overflow-hidden">
            {feed.items.map((item) => (
              <li key={item.id}>
                <ContentCard item={item} now={feed.loadedAt} />
              </li>
            ))}
          </GlassPanel>
        ) : (
          <GlassPanel className="p-5 text-sm text-muted">
            Nothing here yet. New articles and videos arrive every 15 minutes.
          </GlassPanel>
        )
      ) : failed ? (
        <GlassPanel className="flex items-center justify-between gap-3 p-5 text-sm text-muted">
          Couldn’t load the latest content. Check your connection.
          <PillButton size="sm" onClick={() => retry()}>
            Retry
          </PillButton>
        </GlassPanel>
      ) : (
        <div className="glass h-[36rem] animate-pulse rounded-2xl" />
      )}

      {feed && (
        <div ref={end} className="flex min-h-10 items-center justify-center text-[12px] text-muted">
          {failed ? (
            <PillButton size="sm" onClick={() => retry(feed.nextCursor ?? undefined)}>
              Couldn’t load more · Retry
            </PillButton>
          ) : feed.nextCursor ? (
            // The next page is already on its way: this only shows once the end is in view.
            "Loading…"
          ) : (
            feed.items.length > 0 && "You’re all caught up."
          )}
        </div>
      )}
    </section>
  );
}

function ContentCard({ item, now }: { item: ContentEntry; now: number }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint"
    >
      <Thumbnail item={item} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <span className="truncate">{item.source}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.publishedAt} className="shrink-0">
            {timeAgo(item.publishedAt, now)}
          </time>
        </p>
        <h2 className="mt-0.5 line-clamp-3 text-[14px] leading-snug font-semibold">{item.title}</h2>
        {item.summary && (
          <p className="mt-1 line-clamp-2 hidden text-[12.5px] leading-snug text-muted sm:block">
            {item.summary}
          </p>
        )}
        <span className="sr-only">{item.kind === "video" ? "Video" : "Article"}, opens in a new tab</span>
      </div>
    </a>
  );
}

/** A 16:9 picture, with a play badge on videos; the source's initials when there's no picture. */
function Thumbnail({ item }: { item: ContentEntry }) {
  return (
    <div className="relative aspect-video w-32 shrink-0 self-start overflow-hidden rounded-xl bg-line">
      {item.imageUrl ? (
        // Pictures come from many hosts and are small: a plain lazy <img>, not next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center font-display text-lg font-bold text-faint">
          {initials(item.source)}
        </span>
      )}
      {item.kind === "video" && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-8 place-items-center rounded-full bg-black/55 text-white">
            <svg viewBox="0 0 24 24" className="ml-0.5 size-3.5" aria-hidden="true">
              <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
            </svg>
          </span>
        </span>
      )}
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
