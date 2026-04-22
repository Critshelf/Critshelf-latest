import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  User, 
  Shield, 
  Bell, 
  ChevronRight 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function SettingsMenu() {
  const navigate = useNavigate();

  const menuItems = [
    { 
      label: 'Account Settings', 
      icon: User, 
      description: 'Manage your profile data and password',
      to: '/settings/account',
      color: 'text-emerald-accent'
    },
    { 
      label: 'Privacy & Security', 
      icon: Shield, 
      description: 'Control your visibility and data privacy',
      to: '/settings/privacy',
      color: 'text-emerald-accent'
    },
    { 
      label: 'My Preferences', 
      icon: Bell, 
      description: 'Notification and app preferences',
      to: '/settings/preferences',
      color: 'text-emerald-accent'
    },
  ];

  return (
    <div className="min-h-screen bg-charcoal pb-24 pt-24">
      <div className="max-w-2xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center gap-6 mb-12">
          <button 
            onClick={() => navigate('/profile')}
            className="w-12 h-12 bg-white/5 backdrop-blur-md rounded-2xl flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Settings</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs mt-1">Configure your experience</p>
          </div>
        </div>

        {/* Menu List */}
        <div className="space-y-4">
          {menuItems.map((item, idx) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => navigate(item.to)}
              className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 flex items-center justify-between group hover:bg-white/10 transition-all text-left"
            >
              <div className="flex items-center gap-6">
                <div className={cn("w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-emerald-accent/30 transition-colors", item.color)}>
                  <item.icon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white group-hover:text-emerald-accent transition-colors">{item.label}</h3>
                  <p className="text-white/40 text-sm font-medium">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-white/10 group-hover:text-emerald-accent group-hover:translate-x-1 transition-all" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
