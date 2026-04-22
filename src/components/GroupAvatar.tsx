import React from 'react';
import { cn } from '../lib/utils';

interface GroupAvatarProps {
  seed: string | null | undefined;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const GroupAvatar: React.FC<GroupAvatarProps> = ({ seed, className, size = 'md' }) => {
  const avatarUrl = `https://api.dicebear.com/9.x/shapes/svg?seed=${seed || 'default'}`;

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32'
  };

  return (
    <div className={cn(
      "bg-gray-100 rounded-full flex items-center justify-center border border-white/10 shrink-0 overflow-hidden",
      sizeClasses[size],
      className
    )}>
      <img 
        src={avatarUrl} 
        alt="Group Avatar" 
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default GroupAvatar;
