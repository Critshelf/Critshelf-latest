import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, User, Mail, Lock, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile, updateEmail, updatePassword } from 'firebase/auth';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

export default function AccountSettings() {
  const { user, refreshProfile } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setEmail(user.email || '');
      setLoading(false);
    }
  }, [user?.uid, user?.displayName, user?.email]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    try {
      // Update Auth Profile
      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
      }
      
      // Update Auth Email (requires recent login)
      if (email !== user.email) {
        await updateEmail(user, email);
      }

      // Update Auth Password (requires recent login)
      if (password) {
        await updatePassword(user, password);
      }

      // Update Firestore User Doc
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        email
      });

      await refreshProfile();
      setSaved(true);
      setPassword(''); // Clear password field after save
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
            <h1 className="text-4xl font-black text-white tracking-tight">Account</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs mt-1">Personal information</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-emerald-accent animate-spin" />
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-8">
              {/* Display Name */}
              <div className="space-y-3">
                <label className="text-sm font-black text-white/40 uppercase tracking-widest ml-2">Display Name</label>
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-accent transition-colors" />
                  <input 
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={saving}
                    className="w-full bg-charcoal border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all disabled:opacity-50"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-3">
                <label className="text-sm font-black text-white/40 uppercase tracking-widest ml-2">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-accent transition-colors" />
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={saving}
                    className="w-full bg-charcoal border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all disabled:opacity-50"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-3">
                <label className="text-sm font-black text-white/40 uppercase tracking-widest ml-2">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-accent transition-colors" />
                  <input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={saving}
                    className="w-full bg-charcoal border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white font-bold focus:outline-none focus:border-emerald-accent/50 transition-all disabled:opacity-50"
                    placeholder="••••••••"
                  />
                </div>
                <p className="text-xs text-white/20 font-bold ml-2">Leave blank to keep current password</p>
              </div>

              {/* Save Button */}
              <button 
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "w-full py-5 rounded-2xl font-black text-lg shadow-lg transition-all flex items-center justify-center gap-3 mt-4",
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
                    Account Updated!
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>

            {/* Delete Account */}
            <div className="mt-12 pt-12 border-t border-white/5">
              <button className="w-full border-2 border-rose-500/30 text-rose-500 py-4 rounded-2xl font-black hover:bg-rose-500/5 transition-all flex items-center justify-center gap-3 group">
                <Trash2 className="w-5 h-5 group-hover:animate-bounce" />
                Delete Account
              </button>
              <p className="text-center text-white/20 text-xs font-bold mt-4 px-8">
                This action is permanent and will delete all your logged plays, collections, and group memberships.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
