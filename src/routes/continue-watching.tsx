import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { ContinueWatchingShelf } from "@/components/ContinueWatchingShelf";
export const Route = createFileRoute("/continue-watching")({ component: ContinueWatching });
function ContinueWatching() {
  const { user } = useAuth();
  return <main className="mx-auto max-w-6xl px-5 pb-20 pt-32">
    <h1 className="mb-3 border-l-4 border-primary pl-3 text-3xl font-bold">Continue Watching</h1>
    <p className="mb-8 text-sm text-muted-foreground">Your most recently watched shows, with episode progress saved to your account.</p>
    {user ? <ContinueWatchingShelf /> : <p className="text-muted-foreground">Sign in to see your watch history.</p>}
  </main>;
}
