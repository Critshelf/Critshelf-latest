import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, BarChart3, Loader2, Minus, Calendar } from "lucide-react";
import { db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { useUser } from "../contexts/UserContext";
import { logGroupActivity } from "../lib/socialActivityLogger";

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName?: string;
}

const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
}) => {
  const { user, profile } = useUser();
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [closeDate, setCloseDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !user ||
      !title.trim() ||
      options.some((opt) => !opt.trim()) ||
      !closeDate
    )
      return;

    setIsSubmitting(true);
    try {
      const path = "groupPolls";

      const votes: { [key: string]: any[] } = {};
      options.forEach((_, index) => {
        votes[index] = [];
      });

      await addDoc(collection(db, path), {
        groupId,
        title: title.trim(),
        creatorId: user.uid,
        creatorName: user.displayName || "Gamer",
        creatorAvatar:
          user.photoURL ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        options: options.map((opt) => opt.trim()),
        votes,
        closeDate: Timestamp.fromDate(new Date(closeDate)),
        createdAt: serverTimestamp(),
      });

      // Log Activity
      logGroupActivity({
        type: "POLL_RESULT",
        groupId: groupId,
        actorId: user.uid,
        actorName: user.displayName || "Anonymous",
        targetId: "poll", // or some id if available
        targetName: title.trim(),
        metadata: {
          pollTitle: title.trim(),
        },
      });

      setTitle("");
      setOptions(["", ""]);
      setCloseDate("");
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "groupPolls");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-charcoal rounded-[3rem] shadow-2xl overflow-hidden border border-white/10"
          >
            <div className="bg-white/5 p-8 text-white relative overflow-hidden border-b border-white/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-accent/5 rounded-full -mr-16 -mt-16" />
              <button
                onClick={onClose}
                className="absolute top-6 right-6 z-50 cursor-pointer text-white/20 hover:text-white transition-colors p-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-emerald-accent/20">
                  <BarChart3 className="w-6 h-6 text-emerald-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight">
                    Create a Poll
                  </h2>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                    Find the perfect time to play
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar"
            >
              <div className="space-y-2">
                <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">
                  Poll Question / Title
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Game Night Next Week?"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-emerald-accent outline-none transition-all font-bold text-white placeholder:text-white/20"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2 block">
                  Suggested Options
                </label>
                {options.map((option, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      required
                      type="text"
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-emerald-accent outline-none transition-all font-bold text-white placeholder:text-white/20"
                      value={option}
                      onChange={(e) =>
                        handleOptionChange(index, e.target.value)
                      }
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="bg-rose-500/10 text-rose-500 p-4 rounded-2xl hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddOption}
                  className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-white/20 hover:text-emerald-accent hover:border-emerald-accent/30 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add another option
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">
                  Poll Closes On
                </label>
                <div className="relative">
                  <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-accent pointer-events-none" />
                  <input
                    required
                    type="datetime-local"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-white [color-scheme:dark]"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                  />
                </div>
              </div>

              <button
                disabled={isSubmitting}
                type="submit"
                className="w-full bg-emerald-accent text-charcoal py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-emerald-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Creating Poll...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-6 h-6" />
                    Launch Poll
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreatePollModal;
