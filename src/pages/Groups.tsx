import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Plus, ChevronRight, ArrowLeft, MessageSquare, Calendar, Clock, MapPin, Dices } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, serverTimestamp, setDoc, doc, limit, onSnapshot } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import CreateGroupModal from '../components/CreateGroupModal';
import GroupAvatar from '../components/GroupAvatar';

interface Group {
  id: string;
  name: string;
  description: string;
  bannerImage: string;
  avatar: string;
  avatarSeed?: string;
  members: { userId: string; role: 'leader' | 'member' }[];
  memberIds: string[];
  createdBy: string;
  createdAt: any;
}

interface FeedItem {
  id: string;
  groupId: string;
  groupName: string;
  type: 'event' | 'chat' | 'play';
  userName: string;
  userAvatar: string;
  content: string;
  details?: any;
  createdAt: any;
}

export default function Groups() {
  const { user } = useUser();
  const [groups, setGroups] = useState<Group[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const unsubscribeGroups = fetchGroups(user.uid);
      fetchUnifiedFeed();
      return () => unsubscribeGroups();
    }
  }, [user]);

  const fetchGroups = (userId: string) => {
    const path = 'groups';
    const q = query(
      collection(db, path),
      where('memberIds', 'array-contains', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      
      if (groupList.length === 0 && !loading) {
        seedMockGroup(userId);
      } else {
        setGroups(groupList);
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });

    return unsubscribe;
  };

  const fetchUnifiedFeed = () => {
    // In a real app, we'd query multiple collections or a unified activity collection
    // For now, we'll use mock data as requested
    const mockFeed: FeedItem[] = [
      {
        id: 'feed_1',
        groupId: 'friday_night_dice',
        groupName: 'Friday Night Dice',
        type: 'event',
        userName: 'Natasha',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Natasha',
        content: 'Scheduled a new Game Night!',
        details: {
          date: 'Saturday, April 18',
          time: '7:00 PM',
          location: 'Natasha\'s Place',
          game: 'Love Letter'
        },
        createdAt: new Date()
      },
      {
        id: 'feed_2',
        groupId: 'playtest_crew',
        groupName: 'The Playtest Crew',
        type: 'chat',
        userName: 'Marcus',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
        content: 'Who wants to playtest my new worker-removal prototype this weekend?',
        createdAt: new Date(Date.now() - 3600000)
      }
    ];
    setFeedItems(mockFeed);
  };

  const seedMockGroup = async (userId: string) => {
    const path = 'groups';
    try {
      const mockGroup = {
        name: 'Friday Night Dice',
        description: 'Our weekly board game crew! We play everything from light fillers to heavy euros.',
        bannerImage: 'https://picsum.photos/seed/dice/1200/400',
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=FridayNightDice',
        avatarSeed: 'dice',
        members: [
          { userId: userId, role: 'leader' },
          { userId: 'natasha_id', role: 'member' }
        ],
        memberIds: [userId, 'natasha_id'],
        createdBy: userId,
        createdAt: serverTimestamp()
      };
      const groupId = 'friday_night_dice';
      await setDoc(doc(db, path, groupId), mockGroup);
      setGroups([{ id: groupId, ...mockGroup } as Group]);
    } catch (error) {
      console.error("Error seeding mock group:", error);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal pb-32 md:pt-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl font-black text-white tracking-tight mb-2">Groups Hub</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Your gaming communities & social feed</p>
          </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:flex bg-emerald-accent text-charcoal px-8 py-4 rounded-2xl font-black shadow-lg hover:shadow-emerald-accent/20 transition-all items-center gap-2 active:scale-95"
            >
              <Plus className="w-6 h-6" /> Create Group
            </button>
          </div>

          {/* Your Groups Carousel */}
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-accent/10 rounded-xl flex items-center justify-center border border-emerald-accent/20">
                  <Users className="w-6 h-6 text-emerald-accent" />
                </div>
                Your Groups
              </h2>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="sm:hidden text-emerald-accent font-black text-sm"
              >
                Create New
              </button>
            </div>

          <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar -mx-6 px-6">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="min-w-[280px] h-48 bg-white/5 rounded-[2.5rem] animate-pulse border border-white/10 shadow-lg" />
              ))
            ) : (
              <>
                {groups.map((group) => (
                  <Link 
                    key={group.id} 
                    to={`/groups/${group.id}`}
                    className="min-w-[280px] group bg-white/5 rounded-[2.5rem] overflow-hidden shadow-lg border border-white/10 hover:border-emerald-accent/50 transition-all relative"
                  >
                    <div className="h-full w-full absolute inset-0">
                      <img 
                        src={group.bannerImage.replace('1200/400', '600/300')} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-40 group-hover:opacity-60" 
                        alt={group.name}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/40 to-transparent" />
                    </div>
                    <div className="relative h-full p-6 flex flex-col justify-end">
                      <div className="flex items-center gap-3">
                        <GroupAvatar seed={group.avatarSeed} className="border-2 border-white/20 shadow-xl" />
                        <div>
                          <h3 className="text-lg font-black text-white leading-tight">{group.name}</h3>
                          <p className="text-emerald-accent/60 text-xs font-bold">{group.members.length} Members</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                <button className="min-w-[200px] bg-white/5 rounded-[2.5rem] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 hover:bg-white/10 transition-all group">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform border border-white/10">
                    <Plus className="w-6 h-6 text-white/20" />
                  </div>
                  <span className="font-black text-white/20 text-sm uppercase tracking-widest">Join Group</span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* Unified Activity Feed */}
        <section className="max-w-4xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-gold-accent/10 rounded-[1.5rem] flex items-center justify-center shadow-sm border border-gold-accent/20">
              <MessageSquare className="w-8 h-8 text-gold-accent" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Unified Feed</h2>
              <p className="text-white/40 font-bold text-sm uppercase tracking-widest">Latest from all your gaming circles</p>
            </div>
          </div>

          <div className="space-y-6">
            {feedItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.3 }}
                className="bg-white/5 rounded-[3rem] p-8 shadow-2xl border border-white/10 relative group"
              >
                {/* Group Badge */}
                <div className="absolute top-6 right-8">
                  <span className="bg-emerald-accent/10 text-emerald-accent px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-accent/20 shadow-sm">
                    {item.groupName}
                  </span>
                </div>

                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-md border border-white/10">
                    <img src={item.userAvatar} className="w-full h-full object-cover" alt={item.userName} loading="lazy" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-black text-white">{item.userName}</span>
                      <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">• Just now</span>
                    </div>

                    <p className="text-lg font-bold text-white/80 leading-relaxed mb-6">
                      {item.content}
                    </p>

                    {item.type === 'event' && item.details && (
                      <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10 flex flex-col md:flex-row gap-6 items-center">
                        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center shadow-sm border border-white/10 shrink-0">
                          <Calendar className="w-10 h-10 text-gold-accent" />
                        </div>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-emerald-accent" />
                            <div>
                              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Time</p>
                              <p className="font-black text-white">{item.details.date} @ {item.details.time}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-emerald-accent" />
                            <div>
                              <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Location</p>
                              <p className="font-black text-white">{item.details.location}</p>
                            </div>
                          </div>
                        </div>
                        <Link 
                          to={`/groups/${item.groupId}`}
                          className="w-full md:w-auto bg-emerald-accent text-charcoal px-6 py-3 rounded-xl font-black text-sm shadow-lg hover:shadow-emerald-accent/20 transition-all border border-emerald-accent/20 text-center"
                        >
                          RSVP Now
                        </Link>
                      </div>
                    )}

                    {item.type === 'chat' && (
                      <div className="flex items-center gap-4">
                        <Link 
                          to={`/groups/${item.groupId}?tab=chat`}
                          className="flex items-center gap-2 text-emerald-accent font-black text-sm hover:gap-3 transition-all"
                        >
                          Join Conversation <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      <CreateGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(id) => navigate(`/groups/${id}`)}
      />
    </div>
  );
}
