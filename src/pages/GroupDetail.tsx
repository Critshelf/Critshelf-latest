import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Plus,
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
  UserPlus,
  History,
  Check,
  X,
  ChevronRight,
  Trophy,
  Crown,
  Settings,
  Smile,
  Library,
  Dice5,
  SearchX,
  Loader2,
  BarChart3,
  Pencil,
  LogOut,
  UserMinus,
} from "lucide-react";
import { db, OperationType, handleFirestoreError } from "../lib/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  setDoc,
  arrayUnion,
  writeBatch,
} from "firebase/firestore";
import { cn } from "../lib/utils";
import GroupChat from "../components/GroupChat";
import GroupLibrary from "../components/GroupLibrary";
import GroupFeed from "../components/GroupFeed";
import ACBadge from "../components/ACBadge";
import GroupAvatar from "../components/GroupAvatar";
import { useUser } from "../contexts/UserContext";
import CreatePollModal from "../components/CreatePollModal";
import ActivePollsModal from "../components/ActivePollsModal";
import GroupEvents from "../components/GroupEvents";
import CreateEventModal, {
  EventAttendee,
} from "../components/CreateEventModal";
import EventDetailsModal from "../components/EventDetailsModal";
import BringGameModal from "../components/BringGameModal";
import EditGroupAvatarModal from "../components/EditGroupAvatarModal";
import ManageGroupModal from "../components/ManageGroupModal";
import EventCard, { GroupEvent } from "../components/EventCard";
import { Poll } from "../components/PollCard";
import { BarChart3 as PollIcon, Search, Mail } from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import { sendNotification } from "../services/notificationService";

interface Group {
  id: string;
  name: string;
  description: string;
  bannerImage: string;
  avatar: string;
  avatarSeed?: string;
  members: { userId: string; role: "leader" | "member" }[];
  memberIds: string[];
  joinCode?: string;
  isPrivate?: boolean;
  createdBy: string;
}

interface Member {
  uid: string;
  displayName: string;
  photoURL: string;
  avatarPreference?: "google" | "dicebear";
  avatarSeed?: string;
}

interface GameNightEvent {
  id: string;
  title: string;
  description?: string;
  location: string;
  dateTime: any;
  groupId: string;
  creatorId: string;
  attendees: { userId: string; displayName: string; status: string }[];
  gamesBrought?: {
    gameId: string;
    title: string;
    boxArt: string;
    broughtById: string;
    broughtByName: string;
  }[];
  createdAt: any;
  type?: "event";
}

interface GroupRequest {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  gameId: string;
  gameTitle: string;
  gameCover: string;
  owners: { uid: string; displayName: string }[];
  createdAt: any;
  status: "pending" | "accepted" | "rejected" | "scheduled";
  type: "request";
  eventId?: string;
  eventTitle?: string;
}

type FeedItem =
  | (GameNightEvent & { type: "event" })
  | GroupRequest
  | { type: "activity"; [key: string]: any };

export default function GroupDetail() {
  const { user } = useUser();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<GameNightEvent[]>([]);
  const [requests, setRequests] = useState<GroupRequest[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<"none" | "permission">("none");
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [following, setFollowing] = useState<Member[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "feed" | "chat" | "library" | "events"
  >("feed");
  const [activePollsCount, setActivePollsCount] = useState(0);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [isActivePollsOpen, setIsActivePollsOpen] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isEditAvatarOpen, setIsEditAvatarOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<GroupEvent | null>(null);
  const [bringGameEventId, setBringGameEventId] = useState<string | null>(null);
  const [prefilledEventData, setPrefilledEventData] = useState<
    | {
        title?: string;
        dateTime?: string;
        description?: string;
        attendees?: EventAttendee[];
        sourcePollId?: string;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (
      tab === "chat" ||
      tab === "library" ||
      tab === "feed" ||
      tab === "events"
    ) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!id || !user) return;
    const now = new Date();
    const q = query(
      collection(db, "groupPolls"),
      where("groupId", "==", id),
      where("closeDate", ">", now),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivePollsCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [id, user]);

  const handlePollToEvent = (poll: Poll, optionIndex: number) => {
    if (!poll.options[optionIndex]) return;

    // Convert poll votes to event attendees
    const optionVotes = poll.votes[optionIndex.toString()] || [];
    const attendees: EventAttendee[] = optionVotes
      .filter((v) => v.status !== "no")
      .map((v) => ({
        userId: v.userId,
        displayName: v.userName,
        status: v.status === "maybe" ? "maybe" : "going",
      }));

    if (!attendees.some((a) => a.userId === poll.creatorId)) {
      attendees.push({
        userId: poll.creatorId,
        displayName: poll.creatorName,
        status: "going",
      });
    }

    setPrefilledEventData({
      title: poll.title,
      dateTime: poll.options[optionIndex],
      attendees,
      sourcePollId: poll.id,
    });

    setIsActivePollsOpen(false);
    setIsCreateEventOpen(true);
  };

  useEffect(() => {
    if (!id || !user) return;

    // Use onSnapshot for real-time group data updates (members, info, etc.)
    const unsubscribe = onSnapshot(
      doc(db, "groups", id),
      (groupDoc) => {
        if (groupDoc.exists()) {
          const groupData = { id: groupDoc.id, ...groupDoc.data() } as Group;
          setGroup(groupData);
        } else {
          console.warn("Group not found, redirecting...");
          navigate("/social?tab=groups");
        }
        setLoading(false);
      },
      (error: any) => {
        if (error?.code === "permission-denied") {
          setErrorState("permission");
        } else {
          handleFirestoreError(error, OperationType.GET, "groups/" + id);
        }
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [id, user, navigate]);

  // Secondary fetches - only run when relevant data changes or initially
  useEffect(() => {
    if (!id || !group) return;

    // Fetch members profile data whenever memberIds changes
    const memberIds =
      group.memberIds ||
      group.members.map((m: any) => (typeof m === "string" ? m : m.userId));
    fetchMembers(memberIds);
  }, [group?.memberIds, id]);

  useEffect(() => {
    if (!id || !user) return;

    // Setup listeners for feed and events (once per group visit)
    fetchEvents(id);
    fetchRequests(id);
    fetchActivities(id);
    fetchFollowing();

    return () => {};
  }, [id, user]);

  const fetchGroupData = async (groupId: string) => {
    const path = "groups";
    try {
      const groupDoc = await getDoc(doc(db, path, groupId));
      if (groupDoc.exists()) {
        const groupData = { id: groupDoc.id, ...groupDoc.data() } as Group;
        setGroup(groupData);
        fetchMembers(
          groupData.memberIds ||
            groupData.members.map((m: any) =>
              typeof m === "string" ? m : m.userId,
            ),
        );
        fetchEvents(groupId);
        fetchRequests(groupId);
        fetchActivities(groupId);
        fetchFollowing();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  };

  const fetchMembers = async (userIds: string[]) => {
    if (userIds.length === 0) return;

    try {
      // Firestore 'in' query supports up to 30 values.
      // For larger groups, we'd need to chunk this.
      const chunks = [];
      for (let i = 0; i < userIds.length; i += 30) {
        chunks.push(userIds.slice(i, i + 30));
      }

      const allProfiles: Member[] = [];
      for (const chunk of chunks) {
        const q = query(collection(db, "users"), where("uid", "in", chunk));
        const snapshot = await getDocs(q);
        const profiles = snapshot.docs.map(
          (doc) => ({ uid: doc.id, ...doc.data() }) as Member,
        );
        allProfiles.push(...profiles);
      }

      // Handle missing profiles (e.g., mock users not in DB)
      const finalProfiles = userIds.map((uid) => {
        const found = allProfiles.find((p) => p.uid === uid);
        if (found) return found;
        return {
          uid,
          displayName: uid === "natasha_id" ? "Natasha" : "Gamer",
          photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        } as Member;
      });

      setMembers(finalProfiles);
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const fetchEvents = async (groupId: string) => {
    const now = new Date();
    const q = query(
      collection(db, "groupEvents"),
      where("groupId", "==", groupId),
      where("dateTime", ">=", now),
      orderBy("dateTime", "asc"),
      limit(5),
    );

    try {
      const snapshot = await getDocs(q);
      const eventList = snapshot.docs.map(
        (doc) =>
          ({ id: doc.id, ...doc.data(), type: "event" }) as GameNightEvent & {
            type: "event";
          },
      );
      setEvents(eventList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "groupEvents");
    }
  };

  const fetchRequests = async (groupId: string) => {
    const q = query(
      collection(db, "groupRequests"),
      where("groupId", "==", groupId),
      orderBy("createdAt", "desc"),
      limit(10),
    );

    try {
      const snapshot = await getDocs(q);
      const requestList = snapshot.docs
        .map(
          (doc) =>
            ({ id: doc.id, ...doc.data(), type: "request" }) as GroupRequest,
        )
        .filter((r) => r.status === "pending");

      // Add mock request for Friday Night Dice
      if (
        groupId === "friday_night_dice" &&
        !requestList.some((r) => r.id === "mock_request")
      ) {
        requestList.push({
          id: "mock_request",
          groupId: "friday_night_dice",
          userId: "natasha_id",
          userName: "Natasha",
          userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Natasha",
          gameId: "worker-removal-proto",
          gameTitle: "Worker Removal Prototype",
          gameCover:
            "https://images.unsplash.com/photo-1553481187-be93c21490a9?auto=format&fit=crop&q=80&w=400",
          owners: [{ uid: "corey_id", displayName: "Corey" }],
          createdAt: { seconds: Date.now() / 1000 },
          status: "pending",
          type: "request",
        });
      }

      setRequests(requestList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "groupRequests");
    }
  };

  const fetchActivities = async (groupId: string) => {
    // WARNING: Ensure you have built the composite index for the 'activities' collection:
    // groupIds (Arrays) DESC/ASC | timestamp DESC
    console.warn(
      "DEVELOPER REMINDER: Build composite index for collection 'activities': groupIds (array-contains) + timestamp (desc)",
    );

    const q = query(
      collection(db, "activities"),
      where("groupIds", "array-contains", groupId),
      orderBy("timestamp", "desc"),
      limit(20),
    );

    try {
      const snapshot = await getDocs(q);
      const activityList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        type: "activity",
        activityType: doc.data().type,
      }));
      setActivities(activityList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "activities");
    }
  };

  const fetchFollowing = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const followingIds = userDoc.data().following || [];
        if (followingIds.length > 0) {
          const q = query(
            collection(db, "users"),
            where("uid", "in", followingIds.slice(0, 30)),
          );
          const snapshot = await getDocs(q);
          const profiles = snapshot.docs.map(
            (doc) => ({ uid: doc.id, ...doc.data() }) as Member,
          );
          setFollowing(profiles);
        }
      }
    } catch (error) {
      console.error("Error fetching following:", error);
    }
  };

  const handleSendInvites = async () => {
    if (!user || !group || selectedFriends.length === 0) return;

    setIsInviting(true);
    try {
      const promises: Promise<any>[] = [];
      for (const friendId of selectedFriends) {
        // Send In-App Notification directly to the user's personal notifications collection
        promises.push(
          sendNotification(
            friendId,
            "group_invite",
            "Group Invitation! ⚔️",
            `You've been invited to join "${group.name}".`,
            {
              groupId: group.id,
              actionUrl: `/groups/${group.id}`,
            },
          ),
        );
      }
      await Promise.all(promises);
      alert("Invites sent!");
      setIsInviteModalOpen(false);
      setSelectedFriends([]);
      setInviteSearch("");
      setInviteSearchResults([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "notifications");
    } finally {
      setIsInviting(false);
    }
  };

  const acceptInvite = async () => {
    if (!id || !user) return;
    setIsAcceptingInvite(true);
    try {
      const groupRef = doc(db, "groups", id);

      // Update group
      await updateDoc(groupRef, {
        members: arrayUnion({
          userId: user.uid,
          role: "member",
          joinedAt: new Date().toISOString(),
        }),
        memberIds: arrayUnion(user.uid),
      });

      // Delete the notification from the user's inbox
      const notificationsRef = collection(
        db,
        "users",
        user.uid,
        "notifications",
      );
      const q = query(
        notificationsRef,
        where("type", "==", "group_invite"),
        where("groupId", "==", id),
      );
      const notifsSnap = await getDocs(q);

      if (!notifsSnap.empty) {
        const batch = writeBatch(db);
        notifsSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
      }

      setErrorState("none");
      setLoading(true);
      window.location.reload();
    } catch (error) {
      console.error("Failed to accept invite:", error);
      alert("Failed to join group. You might need a valid invite.");
    } finally {
      setIsAcceptingInvite(false);
    }
  };

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteSearch.trim() || !user) return;

    setIsSearchingUsers(true);
    try {
      // Search by email or username
      const emailQuery = query(
        collection(db, "users"),
        where("email", "==", inviteSearch.trim().toLowerCase()),
        limit(10),
      );
      const usernameQuery = query(
        collection(db, "users"),
        where("username", "==", inviteSearch.trim().toLowerCase()),
        limit(10),
      );
      const displayQuery = query(
        collection(db, "users"),
        where("displayName", ">=", inviteSearch.trim()),
        where("displayName", "<=", inviteSearch.trim() + "\uf8ff"),
        limit(10),
      );

      const [emailSnap, userSnap, dispSnap] = await Promise.all([
        getDocs(emailQuery),
        getDocs(usernameQuery),
        getDocs(displayQuery),
      ]);

      const results = new Map();
      [...emailSnap.docs, ...userSnap.docs, ...dispSnap.docs].forEach((doc) => {
        if (doc.id !== user.uid) {
          results.set(doc.id, { uid: doc.id, ...doc.data() });
        }
      });

      setInviteSearchResults(Array.from(results.values()));
    } catch (error) {
      console.error("User search failed:", error);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const feedItems: FeedItem[] = [
    ...events.map((e) => ({ ...e, type: "event" as const })),
    ...requests,
    ...activities,
  ].sort((a, b) => {
    // Some are .timestamp and some are .createdAt
    const getTime = (item: any) => {
      const time = item.timestamp || item.createdAt;
      return time?.seconds || 0;
    };
    return getTime(b) - getTime(a);
  });

  const seedMockEvent = async (groupId: string) => {
    if (!user) return;
    const eventId = `${groupId}_mock_event`;
    const mockEvent = {
      title: "Friday Night Dice (Mock)",
      location: "The Board Game Cafe",
      dateTime: serverTimestamp(),
      groupId,
      creatorId: user.uid,
      attendees: [
        {
          userId: user.uid,
          displayName: user.displayName || "Gamer",
          status: "going",
        },
        { userId: "natasha_id", displayName: "Natasha", status: "going" },
      ],
      gamesBrought: [
        {
          gameId: "loveletter",
          title: "Love Letter",
          boxArt: "https://picsum.photos/seed/loveletter/400/400",
          broughtById: "natasha_id",
          broughtByName: "Natasha",
        },
      ],
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "groupEvents", eventId), mockEvent);
  };

  const formatDate = (date: any) => {
    if (!date) return "";
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return "";
    }
  };

  const formatTime = (date: any) => {
    if (!date) return "";
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  };

  const handleRSVP = async (event: GameNightEvent, status: string) => {
    if (!user) return;

    const currentStatus = event.attendees.find(
      (a) => a.userId === user.uid,
    )?.status;
    if (currentStatus === status) return;

    const otherAttendees = event.attendees.filter((a) => a.userId !== user.uid);
    const updatedAttendees = [
      ...otherAttendees,
      { userId: user.uid, displayName: user.displayName || "Gamer", status },
    ];

    try {
      const eventRef = doc(db, "groupEvents", event.id);
      await updateDoc(eventRef, {
        attendees: updatedAttendees,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "groupEvents");
    }
  };

  const handleCancelEvent = async (event: GroupEvent) => {
    if (!user) return;

    const isOwner = user.uid === group?.createdBy;
    const isCreator = user.uid === event.creatorId;

    if (!isCreator && !isOwner) {
      alert(
        "Unauthorized: Only the host or group owner can cancel this event.",
      );
      return;
    }

    try {
      const eventRef = doc(db, "groupEvents", event.id);
      await deleteDoc(eventRef);
    } catch (error: any) {
      try {
        const eventRef = doc(db, "groupEvents", event.id);
        await updateDoc(eventRef, { status: "cancelled" });
      } catch (softError) {
        handleFirestoreError(error, OperationType.DELETE, "groupEvents");
      }
    }
  };

  const handleAcceptRequest = async (request: GroupRequest) => {
    if (!user || !request.eventId || !id) return;

    try {
      const eventRef = doc(db, "groupEvents", request.eventId);
      const eventSnap = await getDoc(eventRef);

      if (eventSnap.exists()) {
        const eventData = eventSnap.data();
        const gamesBrought = eventData.gamesBrought || [];

        // Check if game already added
        if (!gamesBrought.find((g: any) => g.gameId === request.gameId)) {
          const newGame = {
            gameId: request.gameId,
            title: request.gameTitle,
            boxArt: request.gameCover,
            broughtById: user.uid,
            broughtByName: user.displayName || "Gamer",
            verified: true,
          };

          await updateDoc(eventRef, {
            gamesBrought: [...gamesBrought, newGame],
          });
        }

        // Resolve request
        const requestRef = doc(db, "groupRequests", request.id);
        await updateDoc(requestRef, {
          status: "accepted",
        });
      } else {
        // Fallback for mock or legacy 'events' collection if needed,
        // but new workflow specifically targets 'groupEvents'
        alert("Event not found or belongs to a legacy collection.");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "groupRequests");
    }
  };

  const handleLeaveGroup = async () => {
    if (!user || !group) return;

    const userMember = group.members.find((m) => m.userId === user.uid);
    const otherLeaders = group.members.filter(
      (m) => m.userId !== user.uid && m.role === "leader",
    );

    if (userMember?.role === "leader" && otherLeaders.length === 0) {
      alert(
        "UNAUTHORIZED: You are the sole leader of this group. You must transfer leadership to another member or delete the group via Admin Settings before leaving.",
      );
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to leave this group? Your history remains, but you will lose access to private group features.",
      )
    )
      return;

    try {
      const groupRef = doc(db, "groups", group.id);
      const updatedMembers = group.members.filter((m) => m.userId !== user.uid);
      const updatedMemberIds = (group.memberIds || []).filter(
        (id) => id !== user.uid,
      );

      await updateDoc(groupRef, {
        members: updatedMembers,
        memberIds: updatedMemberIds,
      });

      navigate("/social?tab=groups");
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `groups/${group.id}/leave`,
      );
    }
  };

  const isLeader =
    group?.members?.find((m) => m.userId === user?.uid)?.role === "leader";

  if (errorState === "permission" && !loading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl backdrop-blur-md"
        >
          <div className="w-20 h-20 bg-emerald-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 text-emerald-accent" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Private Group</h2>
          <p className="text-white/40 mb-8 font-medium">
            You need an invitation to view this group. If you were invited, you
            can join below.
          </p>

          <button
            onClick={acceptInvite}
            disabled={isAcceptingInvite}
            className="w-full py-4 bg-emerald-accent text-charcoal rounded-xl font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isAcceptingInvite ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Accept Invite"
            )}
          </button>

          <button
            onClick={() => navigate("/social?tab=groups")}
            className="mt-4 w-full py-4 bg-white/5 text-white/60 rounded-xl font-bold hover:bg-white/10 transition-all"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal pb-32 md:pt-20">
      {/* Banner */}
      <div className="h-64 bg-charcoal relative">
        <img
          src={group.bannerImage || undefined}
          className="w-full h-full object-cover opacity-30 blur-sm"
          alt={group.name}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal to-transparent" />
        <button
          onClick={() => navigate("/social?tab=groups")}
          className="absolute top-8 left-8 w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Group Info & Members */}
          <div className="lg:col-span-1 space-y-8">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white/5 backdrop-blur-xl rounded-[3rem] shadow-2xl p-8 border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <GroupAvatar
                  seed={group.avatarSeed}
                  size="lg"
                  className="border-2 border-white/20 shadow-xl"
                />
                {isLeader && (
                  <button
                    onClick={() => setIsManageModalOpen(true)}
                    className="p-3 bg-gold-accent/10 text-gold-accent rounded-2xl hover:bg-gold-accent transition-all border border-gold-accent/20 hover:text-charcoal group"
                    title="Manage Group"
                  >
                    <Settings className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                  </button>
                )}
              </div>

              <div className="relative">
                {user?.uid === group.createdBy && (
                  <button
                    onClick={() => setIsEditAvatarOpen(true)}
                    className="absolute bottom-6 right-0 md:-right-2 p-2 bg-emerald-accent text-charcoal rounded-full shadow-lg hover:scale-110 transition-all border-2 border-charcoal"
                    title="Edit Avatar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
                {group.name}
              </h1>
              <p className="text-white/40 font-medium mb-6 leading-relaxed">
                {group.description}
              </p>
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full bg-emerald-accent text-charcoal px-6 py-4 rounded-2xl font-black shadow-lg hover:shadow-emerald-accent/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" /> Invite Friends
              </button>

              <div className="pt-2">
                <button
                  onClick={handleLeaveGroup}
                  className="w-full bg-white/5 hover:bg-rose-500/10 text-white/40 hover:text-rose-500 px-6 py-4 rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/5 hover:border-rose-500/20 group relative overflow-hidden"
                >
                  <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-1" />{" "}
                  Leave Group
                </button>
                {isLeader &&
                  group?.members?.filter((m) => m.role === "leader").length ===
                    1 && (
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-3 text-center px-4 leading-relaxed">
                      <span className="text-gold-accent">Note:</span> You are
                      the sole leader. Transfer leadership before leaving.
                    </p>
                  )}
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 backdrop-blur-xl rounded-[3rem] shadow-2xl p-8 border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white">Members</h3>
                <span className="bg-emerald-accent/10 text-emerald-accent px-3 py-1 rounded-full text-xs font-black border border-emerald-accent/20">
                  {(group.memberIds || group.members).length}
                </span>
              </div>
              <div className="space-y-4">
                {members.map((member) => (
                  <Link
                    to={`/profile/${member.uid}`}
                    key={member.uid}
                    className="flex items-center gap-4 group hover:bg-white/5 p-2 -mx-2 rounded-xl transition-all"
                  >
                    <UserAvatar
                      user={member}
                      size="md"
                      className="rounded-xl border border-white/10 group-hover:ring-2 group-hover:ring-emerald-accent transition-all"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-white group-hover:text-emerald-accent transition-colors truncate">
                          {member.displayName}
                        </p>
                        <ACBadge
                          value={(member as any).attackClass}
                          size="sm"
                        />
                      </div>
                      <p className="text-xs font-bold text-white/20 uppercase tracking-widest">
                        {group.members.find((m) => m.userId === member.uid)
                          ?.role === "leader"
                          ? "Leader"
                          : "Member"}
                      </p>
                    </div>
                    {group.members.find((m) => m.userId === member.uid)
                      ?.role === "leader" && (
                      <Crown className="w-4 h-4 text-gold-accent" />
                    )}
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column: Feed & Events */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-emerald-accent rounded-[3rem] p-8 text-charcoal shadow-2xl relative overflow-hidden"
            >
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-black mb-2 tracking-tight">
                    Group Hub
                  </h2>
                  <p className="text-charcoal/70 font-medium">
                    Manage events and schedule sessions.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full flex-nowrap md:flex-wrap lg:flex-nowrap pb-2 md:pb-0">
                  <button
                    onClick={() => {
                      setPrefilledEventData(undefined);
                      setIsCreateEventOpen(true);
                    }}
                    className="flex-1 bg-charcoal text-white px-2 md:px-6 py-4 rounded-2xl font-black shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 text-xs md:text-sm whitespace-nowrap"
                  >
                    <Calendar className="w-4 h-4" /> Event
                  </button>
                  <button
                    onClick={() => setIsCreatePollOpen(true)}
                    className="flex-1 bg-charcoal text-white px-2 md:px-6 py-4 rounded-2xl font-black shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 text-xs md:text-sm whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" /> New Poll
                  </button>
                  <button
                    onClick={() => setIsActivePollsOpen(true)}
                    className={cn(
                      "flex-1 px-2 md:px-6 py-4 rounded-2xl font-black shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2 text-xs md:text-sm border-2 whitespace-nowrap",
                      activePollsCount > 0
                        ? "bg-gold-accent border-transparent text-charcoal shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                        : "bg-charcoal/20 border-charcoal/10 text-charcoal/40",
                    )}
                  >
                    <PollIcon
                      className={cn(
                        "w-4 h-4",
                        activePollsCount > 0
                          ? "text-charcoal"
                          : "text-charcoal/40",
                      )}
                    />
                    Polls{" "}
                    {activePollsCount > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-black/20 rounded-lg text-[10px] tracking-normal">
                        {activePollsCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
                <Trophy className="w-48 h-48" />
              </div>
            </motion.div>

            {/* Tabs */}
            <div className="grid grid-cols-4 gap-2 bg-white/5 p-2 rounded-full shadow-sm border border-white/10 mb-8 w-full overflow-hidden">
              {[
                { id: "feed", label: "Feed", icon: History },
                { id: "chat", label: "Chat", icon: Smile },
                { id: "library", label: "Shelf", icon: Library },
                { id: "events", label: "Events", icon: Calendar },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "px-2 py-3 font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-sm whitespace-nowrap relative rounded-full",
                    activeTab === tab.id
                      ? "text-charcoal"
                      : "text-white/40 hover:text-white/60 hover:bg-white/5",
                  )}
                >
                  <tab.icon
                    className={cn(
                      "w-3 h-3 sm:w-4 sm:h-4 z-10",
                      activeTab === tab.id ? "text-charcoal" : "text-white/20",
                    )}
                  />
                  <span className="z-10">{tab.label}</span>
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-gold-accent rounded-full shadow-lg shadow-gold-accent/20"
                    />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "feed" && (
                <motion.div
                  key="feed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <GroupFeed groupId={id || ""} />
                </motion.div>
              )}

              {activeTab === "chat" && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <GroupChat groupId={id || ""} />
                </motion.div>
              )}

              {activeTab === "library" && (
                <motion.div
                  key="library"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <GroupLibrary groupId={id || ""} members={members} />
                </motion.div>
              )}

              {activeTab === "events" && (
                <motion.div
                  key="events"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <GroupEvents
                    groupId={id || ""}
                    groupOwnerId={group?.createdBy}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        groupId={id || ""}
        groupName={group?.name}
      />

      <ActivePollsModal
        isOpen={isActivePollsOpen}
        onClose={() => setIsActivePollsOpen(false)}
        groupId={id || ""}
        onScheduleEvent={handlePollToEvent}
      />

      <CreateEventModal
        isOpen={isCreateEventOpen}
        onClose={() => {
          setIsCreateEventOpen(false);
          setPrefilledEventData(undefined);
        }}
        groupId={id || ""}
        groupName={group?.name}
        initialData={prefilledEventData}
      />

      {/* Invite Friends Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-charcoal rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl overflow-hidden border-t sm:border border-white/10 p-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-accent/20">
                  <UserPlus className="w-8 h-8 text-emerald-accent" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">
                  Invite Friends
                </h2>
                <p className="text-white/40 font-bold mt-2">
                  Grow the {group.name} crew!
                </p>
              </div>

              {/* User Search Input */}
              <div className="mb-6 space-y-2">
                <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">
                  Search by Username or Email
                </label>
                <form onSubmit={handleSearchUsers} className="relative group">
                  <input
                    type="text"
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                    placeholder="Search gamers..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-white/10 outline-none focus:border-emerald-accent/50 transition-all font-bold"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-accent transition-colors" />
                  {isSearchingUsers && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-accent" />
                    </div>
                  )}
                </form>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {/* Search Results */}
                {inviteSearchResults.length > 0 && (
                  <div className="pb-4 border-b border-white/5 mb-4">
                    <p className="text-[10px] font-black text-emerald-accent uppercase tracking-widest mb-3 ml-2">
                      Search Results
                    </p>
                    <div className="space-y-2">
                      {inviteSearchResults.map((searchedUser) => (
                        <button
                          key={searchedUser.uid}
                          onClick={() => {
                            setSelectedFriends((prev) =>
                              prev.includes(searchedUser.uid)
                                ? prev.filter((id) => id !== searchedUser.uid)
                                : [...prev, searchedUser.uid],
                            );
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                            selectedFriends.includes(searchedUser.uid)
                              ? "bg-emerald-accent/10 border-emerald-accent/30"
                              : "bg-white/5 border-white/10",
                          )}
                        >
                          <img
                            src={searchedUser.photoURL || undefined}
                            alt={searchedUser.displayName}
                            className="w-10 h-10 rounded-lg object-cover border border-white/10"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-black text-white text-sm truncate">
                              {searchedUser.displayName}
                            </h4>
                            <p className="text-[9px] font-bold text-white/20 truncate">
                              {searchedUser.email ||
                                `@${searchedUser.username}`}
                            </p>
                          </div>
                          {selectedFriends.includes(searchedUser.uid) && (
                            <Check className="w-4 h-4 text-emerald-accent" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-3 ml-2">
                  Your Friends
                </p>
                {following.filter(
                  (f) =>
                    !(
                      group.memberIds ||
                      group.members.map((m: any) =>
                        typeof m === "string" ? m : m.userId,
                      )
                    ).includes(f.uid),
                ).length > 0 ? (
                  following
                    .filter(
                      (f) =>
                        !(
                          group.memberIds ||
                          group.members.map((m: any) =>
                            typeof m === "string" ? m : m.userId,
                          )
                        ).includes(f.uid),
                    )
                    .map((friend) => (
                      <button
                        key={friend.uid}
                        onClick={() => {
                          setSelectedFriends((prev) =>
                            prev.includes(friend.uid)
                              ? prev.filter((id) => id !== friend.uid)
                              : [...prev, friend.uid],
                          );
                        }}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                          selectedFriends.includes(friend.uid)
                            ? "bg-emerald-accent/10 border-emerald-accent/30"
                            : "bg-white/5 border-white/10 hover:border-emerald-accent/30",
                        )}
                      >
                        <img
                          src={friend.photoURL || undefined}
                          alt={friend.displayName}
                          className="w-12 h-12 rounded-xl object-cover border border-white/10"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-white truncate">
                            {friend.displayName}
                          </h4>
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                            Friend
                          </p>
                        </div>
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                            selectedFriends.includes(friend.uid)
                              ? "bg-emerald-accent border-emerald-accent text-charcoal"
                              : "border-white/10",
                          )}
                        >
                          {selectedFriends.includes(friend.uid) && (
                            <Check className="w-4 h-4" />
                          )}
                        </div>
                      </button>
                    ))
                ) : (
                  <div className="text-center py-10 bg-white/5 rounded-3xl border border-dashed border-white/10">
                    <SearchX className="w-10 h-10 text-white/10 mx-auto mb-2" />
                    <p className="text-white/20 font-bold">
                      No friends left to invite!
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleSendInvites}
                disabled={isInviting || selectedFriends.length === 0}
                className="w-full mt-8 bg-emerald-accent text-charcoal py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-emerald-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
              >
                {isInviting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Send {selectedFriends.length} Invites
                  </>
                )}
              </button>

              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="w-full mt-4 py-2 text-white/20 font-black uppercase tracking-widest text-xs hover:text-white transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {selectedEvent && (
        <EventDetailsModal
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          event={selectedEvent}
        />
      )}

      {group && (
        <EditGroupAvatarModal
          isOpen={isEditAvatarOpen}
          onClose={() => setIsEditAvatarOpen(false)}
          groupId={group.id}
          currentSeed={group.avatarSeed || "default"}
          onSuccess={(newSeed) => {
            setGroup((prev) =>
              prev ? { ...prev, avatarSeed: newSeed } : null,
            );
          }}
        />
      )}

      {isLeader && (
        <ManageGroupModal
          isOpen={isManageModalOpen}
          onClose={() => setIsManageModalOpen(false)}
          groupId={group.id}
          joinCode={group.joinCode || "N/A"}
          isPrivate={!!group.isPrivate}
          members={members.map((m) => ({
            ...m,
            role:
              group.members.find((gm) => gm.userId === m.uid)?.role || "member",
          }))}
          onRefresh={() => fetchGroupData(group.id)}
        />
      )}

      <BringGameModal
        isOpen={!!bringGameEventId}
        onClose={() => setBringGameEventId(null)}
        eventId={bringGameEventId || ""}
      />
    </div>
  );
}
