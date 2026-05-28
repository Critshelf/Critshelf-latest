import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import Profile from "./pages/Profile";
import GamePage from "./pages/GamePage";
import Collection from "./pages/Collection";
import GroupDetail from "./pages/GroupDetail";
import AllPlays from "./pages/AllPlays";
import ActivityLog from "./pages/ActivityLog";
import FriendReviews from "./pages/FriendReviews";
import UserSearch from "./pages/UserSearchView";
import SocialHub from "./pages/SocialHubView";
import Auth from "./pages/Auth";
import ModerateArt from "./pages/ModerateArt";
import ModerateGame from "./pages/ModerateGame";
import AdminTools from "./pages/AdminTools";
import AdminDashboard from "./pages/AdminDashboard";
import SettingsMenu from "./pages/SettingsMenu";
import AccountSettings from "./pages/AccountSettings";
import PrivacySecurity from "./pages/PrivacySecurity";
import MyPreferences from "./pages/MyPreferences";
import PlayDetails from "./pages/PlayDetails";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { UserProvider, useUser } from "./contexts/UserContext";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-accent animate-spin" />
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-charcoal font-sans text-white flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/game/:id" element={<GamePage />} />
            <Route path="/play/:id" element={<PlayDetails />} />
            <Route path="/collection" element={<Collection />} />
            <Route path="/social" element={<SocialHub />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/friends" element={<SocialHub />} />
            <Route path="/groups" element={<SocialHub />} />
            <Route path="/groups/:id" element={<GroupDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/search-users" element={<UserSearch />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/admin/moderate-art" element={<ModerateArt />} />
            <Route path="/admin/moderate-game" element={<ModerateGame />} />
            <Route path="/admin/tools" element={<AdminTools />} />
            <Route path="/admin-cms" element={<AdminDashboard />} />
            <Route path="/friend-reviews" element={<FriendReviews />} />
            <Route path="/all-plays" element={<AllPlays />} />
            <Route path="/settings" element={<SettingsMenu />} />
            <Route path="/settings/account" element={<AccountSettings />} />
            <Route path="/settings/privacy" element={<PrivacySecurity />} />
            <Route path="/settings/preferences" element={<MyPreferences />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <AppContent />
      </UserProvider>
    </ErrorBoundary>
  );
}
