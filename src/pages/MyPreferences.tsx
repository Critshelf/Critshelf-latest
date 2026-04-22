import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Users, MessageSquare, Zap, Activity, Dices, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

interface ToggleProps {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description: string;
  icon: any;
  disabled?: boolean;
}

function Toggle({ enabled, onChange, label, description, icon: Icon, disabled }: ToggleProps) {
  return (
    <div className={cn(
      "flex items-start justify-between gap-6 p-6 rounded-[2rem] bg-white/5 border border-white/5 hover:border-white/10 transition-all",
      disabled && "opacity-50 pointer-events-none"
    )}>
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 border border-white/10">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black text-white mb-1">{label}</h3>
          <p className="text-sm text-white/30 font-medium leading-relaxed">{description}</p>
        </div>
      </div>
      <button 
        onClick={() => onChange(!enabled)}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
          enabled ? "bg-emerald-accent" : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
            enabled ? "translate-x-6" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

export default function MyPreferences() {
  const { user, profile, refreshProfile, updateNotificationPreferences } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [prefs, setPrefs] = useState({
    moderation: true,
    social: true,
    library: true,
    groups: true
  });

  useEffect(() => {
    if (profile) {
      if (profile.notificationPreferences) {
        setPrefs(profile.notificationPreferences);
      }
      setLoading(false);
    }
  }, [profile]);

  const handleToggle = (key: keyof typeof prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    try {
      await updateNotificationPreferences(prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal pb-24 pt-24">
      <div className="max-w-2xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center gap-6 mb-12">
          <button 
            onClick={() => navigate('/settings')}
            className="w-12 h-12 bg-white/5 backdrop-blur-md rounded-2xl flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Preferences</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs mt-1">Notification controls</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-emerald-accent animate-spin" />
          </div>
        ) : (
          <>
            {/* Toggles */}
            <div className="space-y-6">
              <Toggle 
                enabled={prefs.moderation}
                onChange={() => handleToggle('moderation')}
                label="Moderation Alerts"
                description="Updates on your box art submissions, game imports, and support requests."
                icon={Zap}
                disabled={saving}
              />

              <Toggle 
                enabled={prefs.social}
                onChange={() => handleToggle('social')}
                label="Social Activity"
                description="Notify me when someone follows me, tags me, or likes my activity."
                icon={Users}
                disabled={saving}
              />

              <Toggle 
                enabled={prefs.library}
                onChange={() => handleToggle('library')}
                label="Library & Content"
                description="Alerts when new expansions are added to your games or major content updates."
                icon={Dices}
                disabled={saving}
              />

              <Toggle 
                enabled={prefs.groups}
                onChange={() => handleToggle('groups')}
                label="Group Notifications"
                description="Stay updated with new group activities, invites, and discussions."
                icon={Activity}
                disabled={saving}
              />
            </div>

            {/* Save Button */}
            <div className="mt-12">
              <button 
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "w-full py-5 rounded-2xl font-black text-lg shadow-lg transition-all flex items-center justify-center gap-3",
                  saved 
                    ? "bg-emerald-accent text-charcoal" 
                    : "bg-gold-accent text-charcoal hover:scale-[1.02] active:scale-95",
                  saving && "opacity-70 cursor-not-allowed"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Saving...
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    Preferences Saved!
                  </>
                ) : (
                  'Save Preferences'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
