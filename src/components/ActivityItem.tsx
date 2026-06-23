import React from "react";
import { motion } from "motion/react";
import {
  Dices,
  Plus,
  Users,
  Calendar,
  BarChart2,
  Star,
  PlusCircle,
  Clock,
  Sparkles,
  MessageCircle,
  Share,
} from "lucide-react";
import { cn } from "../lib/utils";
import UserAvatar from "./UserAvatar";
import { ActivityType, ActivityMetadata } from "../lib/activityLogger";
import { formatDistanceToNow } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import LiveGameCover from "./LiveGameCover";

interface ActivityItemProps {
  activity: {
    id: string;
    userId: string;
    userName: string;
    avatarSeed: string;
    type: ActivityType;
    groupId?: string;
    groupName?: string;
    metadata: ActivityMetadata;
    timestamp: any; // Firestore timestamp
  };
  compact?: boolean;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  activity,
  compact = false,
}) => {
  const { userName, type, metadata, timestamp, avatarSeed, groupName, userId } =
    activity;
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (type === "play_logged" || (type as string) === "LOG_PLAY") {
      const route = metadata.playId
        ? `/play/${metadata.playId}`
        : `/game/${metadata.gameId}`;
      navigate(route);
    } else if (metadata.gameId) {
      navigate(`/game/${metadata.gameId}`);
    }
  };

  // Render logic for different types
  const renderContent = () => {
    switch (type) {
      case "play_logged":
      case "LOG_PLAY":
        return (
          <>
            logged a play of{" "}
            <span className="text-gold-accent font-black tracking-tight uppercase underline decoration-gold-accent/30 decoration-2 underline-offset-4">
              {metadata.gameTitle}
            </span>
          </>
        );
      case "game_added":
      case "COLLECTION_ADD":
        return (
          <>
            added{" "}
            <span className="text-gold-accent font-black tracking-tight uppercase underline decoration-gold-accent/30 decoration-2 underline-offset-4">
              {metadata.gameTitle}
            </span>{" "}
            to their{" "}
            <span className="text-gold-accent font-black">
              {metadata.shelf || 'collection'}
            </span>
          </>
        );
      case "new_member":
        return (
          <>
            joined the group{" "}
            <span className="text-gold-accent font-black">
              {groupName || metadata.groupName}
            </span>
          </>
        );
      case "group_created":
        return (
          <>
            created a new group{" "}
            <span className="text-gold-accent font-black underline decoration-gold-accent/30 decoration-2 underline-offset-4">
              {groupName || metadata.groupName}
            </span>
          </>
        );
      case "event_created":
      case "SESSION_SCHEDULED":
        return (
          <>
            scheduled a new event{" "}
            <span className="text-gold-accent font-black underline decoration-gold-accent/30 decoration-2 underline-offset-4">
              {metadata.eventTitle}
            </span>
          </>
        );
      case "poll_started":
        return (
          <>
            started a poll:{" "}
            <span className="text-gold-accent font-black italic">
              "{metadata.pollTitle}"
            </span>
          </>
        );
      case "game_brought":
      case "GAME_REQUESTED":
        return (
          <>
            is bringing{" "}
            <span className="text-gold-accent font-black tracking-tight uppercase underline decoration-gold-accent/30 decoration-2 underline-offset-4">
              {metadata.gameTitle}
            </span>{" "}
            to the game night
          </>
        );
      case "review_added":
      case "REVIEW_GAME":
      case "RATE_GAME":
        return (
          <>
            rated{" "}
            <span className="text-gold-accent font-black tracking-tight uppercase underline decoration-gold-accent/30 decoration-2 underline-offset-4">
              {metadata.gameTitle || metadata.targetName}
            </span>{" "}
            <span className="text-gold-accent font-black">
              {Math.round(metadata.score || 0)}/20
            </span>
          </>
        );
      default:
        return <>performed an action</>;
    }
  };

  const getIcon = () => {
    switch (type) {
      case "play_logged":
        return <Dices className="w-4 h-4 text-emerald-accent" />;
      case "game_added":
        return <PlusCircle className="w-4 h-4 text-gold-accent" />;
      case "new_member":
        return <Users className="w-4 h-4 text-blue-400" />;
      case "group_created":
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case "event_created":
        return <Calendar className="w-4 h-4 text-rose-400" />;
      case "poll_started":
        return <BarChart2 className="w-4 h-4 text-amber-400" />;
      case "game_brought":
        return <Plus className="w-4 h-4 text-emerald-400" />;
      case "review_added":
        return <MessageCircle className="w-4 h-4 text-emerald-accent" />;
      default:
        return <Plus className="w-4 h-4 text-gray-400" />;
    }
  };

  const timeAgo = timestamp?.toDate
    ? formatDistanceToNow(timestamp.toDate(), { addSuffix: true })
    : "Recently";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={handleCardClick}
      className={cn(
        "flex items-start gap-4 rounded-3xl bg-white/5 border border-white/5 hover:border-gold-accent/20 hover:bg-white/10 transition-all group shadow-xl cursor-pointer",
        compact ? "p-3" : "p-4",
      )}
    >
      <Link
        to={`/profile/${userId}`}
        onClick={(e) => e.stopPropagation()}
        className="relative shrink-0"
      >
        <UserAvatar
          user={{ uid: userId, avatarSeed: avatarSeed }}
          size={compact ? "sm" : "md"}
          className="ring-2 ring-white/5 group-hover:ring-gold-accent/30 hover:ring-emerald-accent transition-all"
        />
        <div className="absolute -bottom-1 -right-1 p-1 bg-charcoal rounded-full border border-white/10 shadow-lg group-hover:scale-110 transition-transform">
          {getIcon()}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p
            className={cn(
              "text-white/90 leading-snug",
              compact ? "text-xs" : "text-sm",
            )}
          >
            <Link
              to={`/profile/${userId}`}
              onClick={(e) => e.stopPropagation()}
              className="font-black text-white hover:text-emerald-accent hover:underline transition-colors"
            >
              {userName}
            </Link>{" "}
            {renderContent()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 uppercase tracking-widest">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </div>
          {(groupName || metadata.groupName) &&
            type !== "new_member" &&
            type !== "group_created" && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 uppercase tracking-widest border-l border-white/10 pl-3">
                <Users className="w-3 h-3 text-gold-accent/50" />
                {groupName || metadata.groupName}
              </div>
            )}
          {(type === "LOG_PLAY" || type === "play_logged") && metadata.playId && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const shareData = {
                  title: 'CritShelf Session',
                  text: 'Check out this game session on CritShelf!',
                  url: window.location.origin + '/sessions/' + metadata.playId
                };
                if (navigator.share) {
                  try { await navigator.share(shareData); } catch (err) {}
                } else {
                  navigator.clipboard.writeText(shareData.url);
                  alert("Link copied!");
                }
              }}
              className="flex items-center gap-1.5 text-[10px] font-bold text-white/30 hover:text-emerald-accent uppercase tracking-widest border-l border-white/10 pl-3 transition-colors"
            >
              <Share className="w-3 h-3" /> Share
            </button>
          )}
        </div>
      </div>

      {!compact && (metadata.coverImage || metadata.gameCover) && (
        <Link to={`/game/${metadata.gameId}`} className="shrink-0 w-12 h-16 rounded-lg border border-white/5 shadow-2l group-hover:scale-105 transition-transform duration-300 relative block">
          <LiveGameCover
            gameId={metadata.gameId && metadata.gameId.startsWith('bgg_') ? metadata.gameId : undefined}
            initialCover={metadata.coverImage || metadata.gameCover}
            alt={metadata.gameTitle || ''}
            containerClassName="w-full h-full rounded-lg"
            isApprovalPending={metadata.customImageApproved === false || metadata.isApproved === false}
          />
          {(metadata.customImageApproved === false || metadata.isApproved === false) && (
            <div className="absolute inset-0 flex items-center justify-center p-1 text-center bg-gray-900/60 font-black">
              <span className="text-[6px] uppercase leading-tight text-white/50 tracking-tighter break-all line-clamp-3">
                {metadata.gameTitle}
              </span>
            </div>
          )}
        </Link>
      )}
    </motion.div>
  );
};

export default ActivityItem;
