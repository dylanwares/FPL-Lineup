import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Scout",
  description: "Search and compare every FPL player by projections, underlying stats, value and fixtures.",
};

/** The same shell as the planner, opened on the Scout tab. */
export default function ScoutPage() {
  return <AppShell />;
}
