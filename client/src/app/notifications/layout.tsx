import { Outlet } from "react-router-dom";
import { NavigationBar } from "@/components/NavigationBar";

export default function NotificationsLayout() {
  return (
    <>
      <NavigationBar />
      <main
        className="relative min-h-[calc(100vh-4rem)]"
        style={{
          // Same content wash as PortalShell — one surface language app-wide.
          background: "linear-gradient(160deg, #fff8e7 0%, #ffffff 45%, #fff8e7 100%)",
        }}
      >
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </>
  );
}
