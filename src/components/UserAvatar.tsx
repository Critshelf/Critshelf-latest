import React from 'react';
import { cn } from '../lib/utils';

export interface AvatarUser {
  photoURL?: string | null;
  avatarPreference?: 'google' | 'dicebear';
  avatarSeed?: string;
  uid?: string;
  displayName?: string | null;
}

interface UserAvatarProps {
  user: AvatarUser | null | undefined;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  unreadCount?: number;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user, className, size = 'md', unreadCount = 0 }) => {
  const avatarPreference = user?.avatarPreference || (user?.photoURL ? 'google' : 'dicebear');
  const seed = user?.avatarSeed || user?.uid || 'default';
  
  const dicebearUrl = `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}`;
  const avatarUrl = (avatarPreference === 'google' && user?.photoURL && user.photoURL !== "") 
    ? user.photoURL 
    : dicebearUrl;

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32'
  };

  return (
    <div className={cn(
      "relative shrink-0",
      sizeClasses[size],
      className
    )}>
      <div className="w-full h-full bg-gray-100 rounded-full flex items-center justify-center border border-white/10 overflow-hidden">
        <img 
          src={avatarUrl || dicebearUrl} 
          alt={user?.displayName || "User Avatar"} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
      
      {unreadCount > 0 && (
        <span className={cn(
          "absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-rose-500 font-black text-white ring-2 ring-charcoal z-10",
          size === 'xs' ? 'h-2 w-2 text-[0px]' : 
          size === 'sm' ? 'h-3.5 w-3.5 text-[8px]' : 
          'h-5 w-5 text-[10px]'
        )}>
          {size !== 'xs' && (unreadCount > 9 ? '9+' : unreadCount)}
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
