import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Content",
  description: "The latest FPL articles, tips and videos from around the community, in one feed.",
};

/** The same shell as the planner, opened on the Content tab. */
export default function ContentPage() {
  return <AppShell />;
}
