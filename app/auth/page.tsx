import { redirect } from "next/navigation";

// Back-compat: the original TanStack route was /auth.
export default function Page() {
  redirect("/sign-in");
}
