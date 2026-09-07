import RequireAuth from "@/components/require-auth";
import Workbench from "@/views/Workbench";

export const metadata = { title: "Workbench — Video Speed Reader" };

export default function Page() {
  return (
    <RequireAuth>
      <Workbench />
    </RequireAuth>
  );
}
