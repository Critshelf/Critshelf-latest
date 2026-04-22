import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Shield, EyeOff, MapPinOff, Loader2, CheckCircle2 } from 'lucide-react';
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

export default function PrivacySecurity() {
  const { user, profile, refreshProfile } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [privateProfile, setPrivateProfile] = useState(false);
  const [locationMasking, setLocationMasking] = useState(true);

  useEffect(() => {
    if (profile) {
      if (profile.privacy) {
        setPrivateProfile(profile.privacy.privateProfile ?? false);
        setLocationMasking(profile.privacy.locationMasking ?? true);
      }
      setLoading(false);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        privacy: {
          privateProfile,
          locationMasking
        }
      });
      await refreshProfile();
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
            <h1 className="text-4xl font-black text-white tracking-tight">Privacy</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs mt-1">Control your visibility</p>
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
                enabled={privateProfile}
                onChange={setPrivateProfile}
                label="Private Profile"
                description="Hide my profile and stats from search. Only friends will be able to see your activity."
                icon={EyeOff}
                disabled={saving}
              />

              <Toggle 
                enabled={locationMasking}
                onChange={setLocationMasking}
                label="Location Masking"
                description="Hide specific locations (e.g., addresses or store names) on my logged plays. Only show the city."
                icon={MapPinOff}
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
                    Privacy Saved!
                  </>
                ) : (
                  'Save Privacy Settings'
                )}
              </button>
            </div>

            {/* Info Box */}
            <div className="mt-12 p-8 rounded-[2.5rem] bg-emerald-accent/5 border border-emerald-accent/10">
              <div className="flex gap-4">
                <Shield className="w-6 h-6 text-emerald-accent shrink-0" />
                <p className="text-sm text-emerald-accent/70 font-bold leading-relaxed">
                  Your privacy is our priority. We never share your precise location data with third parties. Location masking is enabled by default for all tabletop sessions.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
