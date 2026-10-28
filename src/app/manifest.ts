import type { MetadataRoute } from "next";

/** The install manifest: standalone, dark splash, the crown icon, and shortcuts to every tab. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FPL Lineup",
    short_name: "FPL Lineup",
    description:
      "Plan your Fantasy Premier League team for every gameweek: transfers, subs, chips and projected points.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07040d",
    theme_color: "#07040d",
    categories: ["sports", "games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Planner", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Fixtures", url: "/fixtures", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Scout", url: "/scout", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Content", url: "/content", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
