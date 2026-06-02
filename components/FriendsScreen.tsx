import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  FriendProfile,
  FriendRequest,
  friendsApi,
} from "../assets/api/friendsApi";
import {
  AppNotification,
  notificationsApi,
} from "../assets/api/notificationsApi";
import { pushNotificationService } from "../assets/api/pushNotificationService";
import { AppButton, AppCard } from "../assets/components";
import { colors, typography } from "../assets/theme";

type FriendsView = "friends" | "add" | "requests" | "notifications";

interface FriendsScreenProps {
  playerId?: string | null;
}

const getProfileName = (profile?: FriendProfile | null) =>
  profile?.player_name || "Unknown player";

const getRequestActor = (
  request: FriendRequest,
  direction: "incoming" | "outgoing",
) => (direction === "incoming" ? request.sender : request.receiver);

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const getRelationshipLabel = (status?: string) => {
  switch (status) {
    case "self":
      return "This is you";
    case "friends":
      return "Already friends";
    case "outgoing_pending":
      return "Request sent";
    case "incoming_pending":
      return "Request received";
    default:
      return null;
  }
};

const canSendFriendRequest = (profile: FriendProfile | null) =>
  !!profile &&
  (!profile.relationship_status || profile.relationship_status === "none");

export default function FriendsScreen({ playerId }: FriendsScreenProps) {
  const [currentView, setCurrentView] = useState<FriendsView>("friends");
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [searchCode, setSearchCode] = useState("");
  const [searchResult, setSearchResult] = useState<FriendProfile | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  );

  const pendingIncomingCount = incomingRequests.length;

  const loadFriendsData = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    setMessage(null);

    try {
      const [
        codeResponse,
        friendsResponse,
        incomingResponse,
        outgoingResponse,
        notificationResponse,
      ] = await Promise.all([
        friendsApi.getMyCode(),
        friendsApi.getFriends(),
        friendsApi.getIncomingRequests(),
        friendsApi.getOutgoingRequests(),
        notificationsApi.getNotifications(),
      ]);

      if (codeResponse.isSuccess && codeResponse.result?.friend_code) {
        setFriendCode(codeResponse.result.friend_code);
      }

      if (friendsResponse.isSuccess) {
        setFriends(friendsResponse.result || []);
      }

      if (incomingResponse.isSuccess) {
        setIncomingRequests(incomingResponse.result || []);
      }

      if (outgoingResponse.isSuccess) {
        setOutgoingRequests(outgoingResponse.result || []);
      }

      if (notificationResponse.isSuccess) {
        setNotifications(notificationResponse.result || []);
      }

      const firstFailure = [
        codeResponse,
        friendsResponse,
        incomingResponse,
        outgoingResponse,
        notificationResponse,
      ].find((response) => !response.isSuccess);

      if (firstFailure) {
        setMessage(
          firstFailure.message ||
            "Friends endpoints are not available yet. Deploy the backend friend API, then pull to refresh.",
        );
      }
    } catch (error: any) {
      setMessage(error.message || "Could not load friends right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadFriendsData();
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadFriendsData]);

  const refresh = () => {
    setRefreshing(true);
    loadFriendsData();
  };

  const searchFriend = async () => {
    const code = searchCode.trim();
    if (!code) {
      setMessage("Enter a friend code first.");
      return;
    }

    setActionId("search");
    setMessage(null);
    setSearchResult(null);

    try {
      const response = await friendsApi.searchByCode(code);

      if (!response.isSuccess || !response.result) {
        setMessage(response.message || "No player found for that friend code.");
        return;
      }

      setSearchResult(response.result);
    } finally {
      setActionId(null);
    }
  };

  const sendRequest = async () => {
    const code = searchResult?.friend_code || searchCode.trim();
    if (!code) {
      return;
    }

    setActionId("send");
    setMessage(null);

    try {
      const response = await friendsApi.sendRequest(code);

      if (!response.isSuccess) {
        setMessage(response.message || "Could not send friend request.");
        return;
      }

      setSearchResult(null);
      setSearchCode("");
      setMessage("Friend request sent.");
      await loadFriendsData();
    } finally {
      setActionId(null);
    }
  };

  const acceptRequest = async (requestId: string) => {
    setActionId(requestId);
    try {
      const response = await friendsApi.acceptRequest(requestId);
      if (!response.isSuccess) {
        Alert.alert("Request failed", response.message || "Could not accept.");
        return;
      }
      await loadFriendsData();
    } finally {
      setActionId(null);
    }
  };

  const rejectRequest = async (requestId: string) => {
    setActionId(requestId);
    try {
      const response = await friendsApi.rejectRequest(requestId);
      if (!response.isSuccess) {
        Alert.alert("Request failed", response.message || "Could not ignore.");
        return;
      }
      await loadFriendsData();
    } finally {
      setActionId(null);
    }
  };

  const removeFriend = (friend: FriendProfile) => {
    Alert.alert(
      "Remove Friend",
      `Remove ${getProfileName(friend)} from your friends?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setActionId(friend.player_id);
            try {
              const response = await friendsApi.removeFriend(friend.player_id);
              if (!response.isSuccess) {
                Alert.alert(
                  "Could not remove",
                  response.message || "Try again in a moment.",
                );
                return;
              }
              await loadFriendsData();
            } finally {
              setActionId(null);
            }
          },
        },
      ],
    );
  };

  const markNotificationRead = async (notificationId: string) => {
    setActionId(notificationId);
    try {
      await notificationsApi.markRead(notificationId);
      await loadFriendsData();
    } finally {
      setActionId(null);
    }
  };

  const markAllNotificationsRead = async () => {
    setActionId("read-all");
    try {
      await notificationsApi.markAllRead();
      await loadFriendsData();
    } finally {
      setActionId(null);
    }
  };

  const enablePushNotifications = async () => {
    setActionId("push");
    try {
      const result = await pushNotificationService.registerForPushNotifications();
      setMessage(
        result.registered
          ? "Push notifications enabled."
          : result.message || "Push notifications could not be enabled.",
      );
    } finally {
      setActionId(null);
    }
  };

  const renderProfileRow = (
    profile: FriendProfile,
    trailing?: React.ReactNode,
  ) => {
    const name = getProfileName(profile);

    return (
      <AppCard key={profile.player_id} style={styles.rowCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(name)}</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{name}</Text>
          {!!profile.friend_code && (
            <Text style={styles.rowSubtitle}>{profile.friend_code}</Text>
          )}
        </View>
        {trailing}
      </AppCard>
    );
  };

  const renderFriendList = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Friends</Text>
        <Text style={styles.sectionCount}>{friends.length}</Text>
      </View>

      {friends.length === 0 ? (
        <EmptyState
          icon="group-add"
          title="No friends yet"
          body="Add friends by sharing or searching friend codes."
        />
      ) : (
        friends.map((friend) =>
          renderProfileRow(
            friend,
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => removeFriend(friend)}
              disabled={actionId === friend.player_id}
            >
              {actionId === friend.player_id ? (
                <ActivityIndicator color={colors.red[500]} />
              ) : (
                <MaterialIcons
                  name="person-remove"
                  size={22}
                  color={colors.red[500]}
                />
              )}
            </TouchableOpacity>,
          ),
        )
      )}
    </View>
  );

  const renderAddFriend = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Add Friend</Text>
      <AppCard style={styles.codeCard}>
        <Text style={styles.label}>Your friend code</Text>
        <Text style={styles.friendCode}>{friendCode || "Not available yet"}</Text>
      </AppCard>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={searchCode}
          onChangeText={(value) => setSearchCode(value.toUpperCase())}
          placeholder="Enter friend code"
          placeholderTextColor={colors.stone[400]}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={searchFriend}
          disabled={actionId === "search"}
        >
          {actionId === "search" ? (
            <ActivityIndicator color={colors.ink[900]} />
          ) : (
            <MaterialIcons name="search" size={24} color={colors.ink[900]} />
          )}
        </TouchableOpacity>
      </View>

      {searchResult && (
        <View style={styles.searchResult}>
          {renderProfileRow(
            searchResult,
            canSendFriendRequest(searchResult) ? (
              <AppButton
                title="Send"
                onPress={sendRequest}
                disabled={actionId === "send"}
                style={styles.compactButton}
              />
            ) : (
              <Text style={styles.relationshipText}>
                {getRelationshipLabel(searchResult.relationship_status) ||
                  "Unavailable"}
              </Text>
            ),
          )}
        </View>
      )}
    </View>
  );

  const renderRequests = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Incoming Requests</Text>
        <Text style={styles.sectionCount}>{incomingRequests.length}</Text>
      </View>

      {incomingRequests.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No incoming requests"
          body="New friend requests will appear here."
        />
      ) : (
        incomingRequests.map((request) => {
          const actor = getRequestActor(request, "incoming");
          return (
            <AppCard key={request.id} style={styles.requestCard}>
              <View style={styles.requestContent}>
                <Text style={styles.rowTitle}>{getProfileName(actor)}</Text>
                <Text style={styles.rowSubtitle}>Wants to add you</Text>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={[styles.requestButton, styles.rejectButton]}
                  onPress={() => rejectRequest(request.id)}
                  disabled={actionId === request.id}
                >
                  <MaterialIcons name="close" size={20} color={colors.red[500]} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.requestButton, styles.acceptButton]}
                  onPress={() => acceptRequest(request.id)}
                  disabled={actionId === request.id}
                >
                  <MaterialIcons
                    name="check"
                    size={20}
                    color={colors.ink[900]}
                  />
                </TouchableOpacity>
              </View>
            </AppCard>
          );
        })
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sent Requests</Text>
        <Text style={styles.sectionCount}>{outgoingRequests.length}</Text>
      </View>

      {outgoingRequests.length === 0 ? (
        <EmptyState
          icon="outbox"
          title="No sent requests"
          body="Requests you send will be listed here."
        />
      ) : (
        outgoingRequests.map((request) => {
          const actor = getRequestActor(request, "outgoing");
          return (
            <AppCard key={request.id} style={styles.rowCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(getProfileName(actor))}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{getProfileName(actor)}</Text>
                <Text style={styles.rowSubtitle}>Pending</Text>
              </View>
            </AppCard>
          );
        })
      )}
    </View>
  );

  const renderNotifications = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllNotificationsRead}>
            <Text style={styles.linkText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <AppButton
        title="Enable Push Notifications"
        onPress={enablePushNotifications}
        variant="secondary"
        disabled={actionId === "push"}
        style={styles.pushButton}
        icon={<MaterialIcons name="notifications" size={20} color={colors.tea[500]} />}
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon="notifications-none"
          title="No notifications"
          body="Friend request updates will appear here."
        />
      ) : (
        notifications.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => markNotificationRead(item.id)}
            disabled={item.is_read || actionId === item.id}
            activeOpacity={0.8}
          >
            <AppCard
              style={[
                styles.notificationCard,
                !item.is_read && styles.unreadNotification,
              ]}
            >
              <MaterialIcons
                name={item.is_read ? "notifications-none" : "notifications-active"}
                size={22}
                color={item.is_read ? colors.stone[400] : colors.tea[500]}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSubtitle}>{item.body}</Text>
              </View>
            </AppCard>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderActiveView = () => {
    switch (currentView) {
      case "add":
        return renderAddFriend();
      case "requests":
        return renderRequests();
      case "notifications":
        return renderNotifications();
      case "friends":
      default:
        return renderFriendList();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Friends</Text>
          <Text style={styles.subtitle}>
            {playerId ? "Add friends and manage requests" : "Sign in required"}
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <SegmentButton
          label="Friends"
          icon="people"
          active={currentView === "friends"}
          onPress={() => setCurrentView("friends")}
        />
        <SegmentButton
          label="Add"
          icon="person-add"
          active={currentView === "add"}
          onPress={() => setCurrentView("add")}
        />
        <SegmentButton
          label={`Requests${pendingIncomingCount ? ` ${pendingIncomingCount}` : ""}`}
          icon="inbox"
          active={currentView === "requests"}
          onPress={() => setCurrentView("requests")}
        />
        <SegmentButton
          label={`Alerts${unreadCount ? ` ${unreadCount}` : ""}`}
          icon="notifications"
          active={currentView === "notifications"}
          onPress={() => setCurrentView("notifications")}
        />
      </View>

      {!!message && (
        <AppCard style={styles.messageCard}>
          <MaterialIcons name="info" size={20} color={colors.peach[500]} />
          <Text style={styles.messageText}>{message}</Text>
        </AppCard>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.tea[500]} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.tea[500]}
            />
          }
        >
          {renderActiveView()}
        </ScrollView>
      )}
    </View>
  );
}

function SegmentButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <MaterialIcons
        name={icon}
        size={18}
        color={active ? colors.ink[900] : colors.stone[300]}
      />
      <Text
        style={[styles.segmentText, active && styles.segmentTextActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <AppCard style={styles.emptyCard}>
      <MaterialIcons name={icon} size={36} color={colors.stone[400]} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink[900],
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.bodyMuted,
    marginTop: 4,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ink[700],
    backgroundColor: colors.ink[800],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  segmentButtonActive: {
    backgroundColor: colors.tea[500],
    borderColor: colors.tea[500],
  },
  segmentText: {
    ...typography.caption,
    color: colors.stone[300],
    marginTop: 2,
    textAlign: "center",
  },
  segmentTextActive: {
    color: colors.ink[900],
    fontWeight: "700",
  },
  messageCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    padding: 12,
    borderColor: colors.peach[500],
    borderWidth: 1,
  },
  messageText: {
    ...typography.small,
    flex: 1,
    color: colors.stone[100],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    ...typography.h2,
  },
  sectionCount: {
    ...typography.small,
    color: colors.tea[500],
    fontWeight: "700",
  },
  codeCard: {
    padding: 16,
  },
  label: {
    ...typography.caption,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  friendCode: {
    ...typography.h2,
    marginTop: 6,
    color: colors.tea[500],
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.ink[800],
    borderColor: colors.ink[700],
    borderWidth: 1,
    borderRadius: 8,
    color: colors.stone[100],
    paddingHorizontal: 14,
  },
  searchButton: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.tea[500],
    alignItems: "center",
    justifyContent: "center",
  },
  searchResult: {
    marginTop: 4,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink[700],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    ...typography.small,
    color: colors.tea[500],
    fontWeight: "800",
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: "700",
  },
  rowSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  compactButton: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  relationshipText: {
    ...typography.small,
    color: colors.tea[500],
    fontWeight: "700",
    textAlign: "right",
    maxWidth: 100,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  requestContent: {
    flex: 1,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  requestButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButton: {
    backgroundColor: colors.red[500] + "20",
  },
  acceptButton: {
    backgroundColor: colors.tea[500],
  },
  pushButton: {
    marginBottom: 4,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  unreadNotification: {
    borderColor: colors.tea[500],
    borderWidth: 1,
  },
  linkText: {
    ...typography.small,
    color: colors.tea[500],
    fontWeight: "700",
  },
  emptyCard: {
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: 10,
  },
  emptyBody: {
    ...typography.small,
    textAlign: "center",
    marginTop: 4,
  },
});
