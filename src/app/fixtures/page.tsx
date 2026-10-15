import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Fixtures",
  description: "Every Premier League team's upcoming fixtures, coloured by FPL difficulty.",
};

/** The same shell as the planner, opened on the Fixtures tab. */
export default function FixturesPage() {
  return <AppShell />;
}
