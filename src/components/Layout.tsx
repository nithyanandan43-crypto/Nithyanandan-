import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { MessageSquare, Image as ImageIcon, Settings, Sparkles, Search } from 'lucide-react';
import { motion } from 'motion/react';

export function Layout() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-xl p-6 gap-8">
        <div className="flex items-center gap-2 text-blue-400 font-display font-bold text-xl tracking-tight">
          <Sparkles className="w-6 h-6" />
          <span>Gemini Live</span>
        </div>

        <nav className="flex flex-col gap-2">
          <NavItem to="/" icon={<MessageSquare className="w-5 h-5" />} label="Live Session" />
          <NavItem to="/gallery" icon={<ImageIcon className="w-5 h-5" />} label="AI Gallery" />
          <NavItem to="/seo" icon={<Search className="w-5 h-5" />} label="SEO Optimizer" />
          <NavItem to="/settings" icon={<Settings className="w-5 h-5" />} label="Settings" />
        </nav>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2 text-blue-400 font-display font-bold text-lg tracking-tight">
          <Sparkles className="w-5 h-5" />
          <span>Gemini Live</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto pb-24 md:pb-0">
        {/* Background Glows */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]" />
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px]" />
        </div>
        
        <div className="relative z-10 h-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-around px-6 z-50">
        <MobileNavItem to="/" icon={<MessageSquare className="w-6 h-6" />} label="Live" />
        <MobileNavItem to="/gallery" icon={<ImageIcon className="w-6 h-6" />} label="Gallery" />
        <MobileNavItem to="/seo" icon={<Search className="w-6 h-6" />} label="SEO" />
        <MobileNavItem to="/settings" icon={<Settings className="w-6 h-6" />} label="Settings" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink 
      to={to}
      className={({ isActive }) => `
        flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium
        ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}
      `}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function MobileNavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink 
      to={to}
      className={({ isActive }) => `
        flex flex-col items-center gap-1 transition-all
        ${isActive ? 'text-blue-400' : 'text-zinc-500'}
      `}
    >
      {({ isActive }) => (
        <>
          <div className={`p-2 rounded-full transition-all ${isActive ? 'bg-blue-500/10' : ''}`}>
            {icon}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
          {isActive && (
            <motion.div 
              layoutId="mobile-nav-indicator"
              className="absolute -top-px w-8 h-1 bg-blue-400 rounded-full"
            />
          )}
        </>
      )}
    </NavLink>
  );
}
