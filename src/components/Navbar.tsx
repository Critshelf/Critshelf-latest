import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, User, Users, Plus, LogIn, Bell, LogOut, Settings, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import LogPlayModal from './LogPlayModal';
import { useUser } from '../contexts/UserContext';
import UserAvatar from './UserAvatar';
import NotificationTray from './NotificationTray';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Navbar() {
  const { user, profile, signOut } = useUser();
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/browse', icon: Search, label: 'Browse' },
    { to: 'log', icon: Plus, label: 'Log Play', isAction: true },
    { to: '/social', icon: Users, label: 'Social' },
  ];

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const notificationsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notificationsRef, where('isRead', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  // Close menus on route change
  useEffect(() => {
    setShowProfileMenu(false);
    setShowNotifications(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      <nav className="fixed bottom-6 left-6 right-6 bg-charcoal/80 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-[2rem] px-4 py-3 z-50 md:top-6 md:bottom-auto md:max-w-4xl md:mx-auto">
        <div className="flex justify-around items-center">
          {navItems.map(({ to, icon: Icon, label, isAction }) => (
            isAction ? (
              <button
                key={to}
                onClick={() => user ? setIsLogModalOpen(true) : navigate('/auth')}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all duration-300 px-4 py-2 rounded-2xl group",
                  user ? "text-gold-accent hover:bg-gold-accent/10" : "text-white/20 hover:text-white"
                )}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-transform group-hover:scale-110",
                  user ? "bg-gold-accent text-charcoal shadow-[0_0_15px_rgba(251,191,36,0.4)]" : "bg-white/10 text-white/40"
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">{label}</span>
              </button>
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => cn(
                  "flex flex-col items-center gap-1 transition-all duration-300 px-4 py-2 rounded-2xl",
                  isActive 
                    ? "text-emerald-accent" 
                    : "text-white/40 hover:text-emerald-accent hover:bg-emerald-accent/10"
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">{label}</span>
              </NavLink>
            )
          ))}

          {/* Profile Item (Special) */}
          <div className="relative" ref={profileMenuRef}>
            {user ? (
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all duration-300 px-4 py-2 rounded-2xl group",
                  showProfileMenu ? "text-emerald-accent bg-emerald-accent/10" : "text-white/40 hover:text-emerald-accent hover:bg-emerald-accent/10"
                )}
              >
                <UserAvatar 
                  user={profile || user} 
                  size="xs" 
                  className={cn(
                    "w-6 h-6 rounded-lg transition-transform group-hover:scale-110",
                    showProfileMenu && "ring-2 ring-emerald-accent ring-offset-2 ring-offset-charcoal"
                  )}
                  unreadCount={unreadCount}
                />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Profile</span>
              </button>
            ) : (
              <NavLink
                to="/auth"
                className={({ isActive }) => cn(
                  "flex flex-col items-center gap-1 transition-all duration-300 px-4 py-2 rounded-2xl",
                  isActive 
                    ? "text-emerald-accent" 
                    : "text-white/40 hover:text-emerald-accent hover:bg-emerald-accent/10"
                )}
              >
                <LogIn className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Sign In</span>
              </NavLink>
            )}

            {/* Profile Dropdown */}
            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full mb-4 right-0 w-64 bg-charcoal/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden z-[100] md:bottom-auto md:top-full md:mt-4"
                >
                  <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-white/5">
                    <UserAvatar user={profile || user} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white truncate">{profile?.displayName || user?.displayName || 'User'}</p>
                      <p className="text-[9px] font-bold text-white/40 truncate uppercase tracking-widest">@{profile?.username || 'critter'}</p>
                    </div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={() => navigate('/profile')}
                      className="w-full flex items-center gap-3 p-3 text-white/60 hover:text-white hover:bg-white/5 rounded-2xl transition-all group"
                    >
                      <User className="w-4 h-4 text-emerald-accent" />
                      <span className="flex-1 text-left text-[11px] font-black uppercase tracking-widest">My Profile</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    <button
                      onClick={() => {
                        setShowNotifications(true);
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 text-white/60 hover:text-white hover:bg-white/5 rounded-2xl transition-all group"
                    >
                      <div className="relative">
                        <Bell className="w-4 h-4 text-gold-accent" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full" />
                        )}
                      </div>
                      <span className="flex-1 text-left text-[11px] font-black uppercase tracking-widest">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-rose-500/20 text-rose-500 text-[9px] font-black px-2 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => navigate('/settings')}
                      className="w-full flex items-center gap-3 p-3 text-white/60 hover:text-white hover:bg-white/5 rounded-2xl transition-all group"
                    >
                      <Settings className="w-4 h-4 text-blue-400" />
                      <span className="flex-1 text-left text-[11px] font-black uppercase tracking-widest">Settings</span>
                      <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>

                    <div className="my-2 border-t border-white/5" />

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 p-3 text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/5 rounded-2xl transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="flex-1 text-left text-[11px] font-black uppercase tracking-widest">Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      <NotificationTray 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />

      <LogPlayModal 
        isOpen={isLogModalOpen} 
        onClose={() => setIsLogModalOpen(false)} 
      />
    </>
  );
}
