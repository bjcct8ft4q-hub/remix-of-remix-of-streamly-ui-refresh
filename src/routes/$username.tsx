import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/$username")({ component: UsernameProfile });
function UsernameProfile() {
  const { username } = Route.useParams();
  return <Navigate to="/public-profile" search={{ username }} replace />;
}
