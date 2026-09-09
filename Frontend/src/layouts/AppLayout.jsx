import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import Sidebar from '../Components/Sidebar';
import Topbar from '../Components/Topbar';

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#000806] text-[#E8F0F2]">

      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="lg:pl-64">

        <Topbar
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="min-h-[calc(100vh-76px)] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>

      </div>

    </div>
  );
}

export default AppLayout;