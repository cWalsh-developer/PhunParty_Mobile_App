import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Camera, CameraView } from "expo-camera";
import { useFocusEffect } from "expo-router";
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import qrcodeGenerator from "qrcode-generator";
import {
  FriendProfile,
  FriendProfileStats,
  FriendRequest,
  friendsApi,
} from "../assets/api/friendsApi";
import { FriendPresence, presenceApi } from "../assets/api/presenceApi";
import { pushNotificationService } from "../assets/api/pushNotificationService";
import { AppButton, AppCard } from "../assets/components";
import { colors, typography } from "../assets/theme";
import { AuthenticatedImage } from "./AuthenticatedImage";

type FriendsView = "friends" | "add" | "requests";

interface FriendsScreenProps {
  playerId?: string | null;
  onAuthInvalid?: () => void;
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

const canShowOnlineStatus = (profile?: FriendProfile | null) =>
  !!profile?.is_online && profile.show_online_status !== false;

const FRIEND_QR_TYPE = "phunparty_friend_code";
const FRIEND_CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

const normalizeFriendCode = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, "");

const createFriendQrValue = (code: string) =>
  JSON.stringify({
    type: FRIEND_QR_TYPE,
    friend_code: normalizeFriendCode(code),
  });

const extractFriendCodeFromQr = (data: string) => {
  const directCode = normalizeFriendCode(data);
  if (FRIEND_CODE_PATTERN.test(directCode)) {
    return directCode;
  }

  try {
    const parsed = JSON.parse(data);
    const parsedCode = normalizeFriendCode(
      parsed.friend_code || parsed.friendCode || "",
    );

    if (
      (!parsed.type || parsed.type === FRIEND_QR_TYPE) &&
      FRIEND_CODE_PATTERN.test(parsedCode)
    ) {
      return parsedCode;
    }
  } catch {
    // Fall through to URL parsing.
  }

  try {
    const url = new URL(data);
    const urlCode = normalizeFriendCode(
      url.searchParams.get("friend_code") || url.searchParams.get("code") || "",
    );

    if (FRIEND_CODE_PATTERN.test(urlCode)) {
      return urlCode;
    }
  } catch {
    return null;
  }

  return null;
};

export default function FriendsScreen({
  playerId,
  onAuthInvalid,
}: FriendsScreenProps) {
  const [currentView, setCurrentView] = useState<FriendsView>("friends");
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [searchCode, setSearchCode] = useState("");
  const [searchResult, setSearchResult] = useState<FriendProfile | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [presenceByPlayerId, setPresenceByPlayerId] = useState<
    Record<string, FriendPresence>
  >({});
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<FriendProfile | null>(
    null,
  );
  const [profileStats, setProfileStats] = useState<FriendProfileStats | null>(
    null,
  );
  const [profileStatsLoading, setProfileStatsLoading] = useState(false);
  const [profileStatsMessage, setProfileStatsMessage] = useState<string | null>(
    null,
  );
  const [scannerPermission, setScannerPermission] = useState<boolean | null>(
    null,
  );
  const [scannerScanned, setScannerScanned] = useState(false);
  const pushRegistrationAttemptedRef = useRef(false);

  const friendQrValue = useMemo(
    () => (friendCode ? createFriendQrValue(friendCode) : ""),
    [friendCode],
  );

  const pendingIncomingCount = incomingRequests.length;

  const mergePresenceIntoProfile = useCallback(
    (profile: FriendProfile): FriendProfile => ({
      ...profile,
      ...(presenceByPlayerId[profile.player_id] || {}),
    }),
    [presenceByPlayerId],
  );

  const loadFriendPresence = useCallback(async () => {
    if (!playerId) {
      return;
    }

    try {
      const response = await presenceApi.getFriendsPresence();

      if (!response.isSuccess) {
        return;
      }

      const nextPresence = (response.result || []).reduce<
        Record<string, FriendPresence>
      >((acc, item) => {
        acc[item.player_id] = item;
        return acc;
      }, {});

      setPresenceByPlayerId(nextPresence);
    } catch {
      // Presence is best-effort; the friend list should remain usable offline.
    }
  }, [playerId]);

  const loadFriendsData = useCallback(async (showLoader = false, silent = false) => {
    if (!playerId) {
      setLoading(false);
      setRefreshing(false);
      if (!silent) {
        setMessage("Sign in again to use friends.");
      }
      return;
    }

    if (showLoader) {
      setLoading(true);
    }
    if (!silent) {
      setMessage(null);
    }

    try {
      const [
        codeResponse,
        friendsResponse,
        incomingResponse,
        outgoingResponse,
      ] = await Promise.all([
        friendsApi.getMyCode(),
        friendsApi.getFriends(),
        friendsApi.getIncomingRequests(),
        friendsApi.getOutgoingRequests(),
      ]);

      if (codeResponse.isSuccess && codeResponse.result?.friend_code) {
        setFriendCode(codeResponse.result.friend_code);

        if (
          codeResponse.result.friend_request_notifications_enabled &&
          !pushRegistrationAttemptedRef.current
        ) {
          pushRegistrationAttemptedRef.current = true;
          const pushResult =
            await pushNotificationService.registerForPushNotifications();

          if (!pushResult.registered) {
            setMessage(
              pushResult.message ||
                "This device is not registered for push notifications.",
            );
          }
        }
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

      loadFriendPresence();

      const firstFailure = [
        codeResponse,
        friendsResponse,
        incomingResponse,
        outgoingResponse,
      ].find((response) => !response.isSuccess);

      if (firstFailure) {
        if (firstFailure.status === 401) {
          if (!silent) {
            setMessage("Your session has expired. Please log in again.");
          }
          onAuthInvalid?.();
          return;
        }

        if (!silent) {
          setMessage(
            firstFailure.message ||
              "Friends endpoints are not available yet. Deploy the backend friend API, then pull to refresh.",
          );
        }
      }
    } catch (error: any) {
      if (!silent) {
        setMessage(error.message || "Could not load friends right now.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadFriendPresence, onAuthInvalid, playerId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadFriendsData();
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadFriendsData]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let isMounted = true;

    pushNotificationService
      .addFriendNotificationListeners((event) => {
        if (event.type === "friend_request_received") {
          setCurrentView("requests");
        }

        loadFriendsData(false);
      })
      .then((removeListeners) => {
        if (isMounted) {
          cleanup = removeListeners;
          return;
        }

        removeListeners();
      })
      .catch(() => {
        setMessage("Could not attach friend notification listeners.");
      });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [loadFriendsData]);

  useFocusEffect(
    useCallback(() => {
      if (playerId) {
        loadFriendsData(false, true);
      }
    }, [loadFriendsData, playerId]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!playerId) {
        return undefined;
      }

      loadFriendPresence();
      const interval = setInterval(loadFriendPresence, 15000);

      return () => clearInterval(interval);
    }, [loadFriendPresence, playerId]),
  );

  useEffect(() => {
    if (!playerId) {
      return;
    }

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadFriendsData(false, true);
        loadFriendPresence();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [loadFriendPresence, loadFriendsData, playerId]);

  const refresh = () => {
    setRefreshing(true);
    loadFriendsData();
  };

  const searchFriendCode = async (friendCodeToSearch: string) => {
    const code = normalizeFriendCode(friendCodeToSearch);
    if (!code) {
      setMessage("Enter a friend code first.");
      return;
    }

    setActionId("search");
    setMessage(null);
    setSearchResult(null);
    setSearchCode(code);

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

  const searchFriend = async () => {
    await searchFriendCode(searchCode);
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
    const request = incomingRequests.find((item) => item.id === requestId);

    try {
      const response = await friendsApi.acceptRequest(requestId);
      if (!response.isSuccess) {
        Alert.alert("Request failed", response.message || "Could not accept.");
        return;
      }

      setIncomingRequests((prev) =>
        prev.filter((item) => item.id !== requestId),
      );

      const newFriend = request?.sender || response.result?.sender;
      if (newFriend) {
        setFriends((prev) => {
          const exists = prev.some(
            (friend) => friend.player_id === newFriend.player_id,
          );

          if (exists) {
            return prev;
          }

          return [
            {
              ...newFriend,
              relationship_status: "friends",
            },
            ...prev,
          ];
        });
      }

      loadFriendsData(false);
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

              setFriends((prev) =>
                prev.filter((item) => item.player_id !== friend.player_id),
              );
              loadFriendsData(false);
            } finally {
              setActionId(null);
            }
          },
        },
      ],
    );
  };

  const openFriendScanner = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    const hasPermission = status === "granted";

    setScannerPermission(hasPermission);
    setScannerScanned(false);
    setScannerVisible(true);
  };

  const handleFriendQrScanned = async ({ data }: { data: string }) => {
    if (scannerScanned) {
      return;
    }

    setScannerScanned(true);
    const scannedFriendCode = extractFriendCodeFromQr(data);

    if (!scannedFriendCode) {
      Alert.alert(
        "Invalid Friend QR",
        "That QR code does not contain a PhunParty friend code.",
        [
          {
            text: "Try Again",
            onPress: () => setScannerScanned(false),
          },
        ],
      );
      return;
    }

    setScannerVisible(false);
    setCurrentView("add");
    await searchFriendCode(scannedFriendCode);
  };

  const openFriendProfile = async (profile: FriendProfile) => {
    setProfileModalVisible(true);
    setProfileLoading(true);
    setSelectedProfile(null);
    setProfileStats(null);
    setProfileStatsMessage(null);
    setMessage(null);

    try {
      const response = await friendsApi.getProfile(profile.player_id);

      if (!response.isSuccess || !response.result) {
        setProfileModalVisible(false);
        Alert.alert(
          "Profile unavailable",
          response.message ||
            "This player has not made their profile visible to you.",
        );
        return;
      }

      if (response.result.can_view_profile === false) {
        setProfileModalVisible(false);
        Alert.alert(
          "Profile unavailable",
          "This player has not made their profile visible to you.",
        );
        return;
      }

      setSelectedProfile(mergePresenceIntoProfile(response.result));
    } catch (error: any) {
      setProfileModalVisible(false);
      Alert.alert(
        "Profile unavailable",
        error.message || "Could not load this profile right now.",
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const loadProfileStats = async () => {
    if (!selectedProfile) {
      return;
    }

    setProfileStatsLoading(true);
    setProfileStatsMessage(null);

    try {
      const response = await friendsApi.getProfileStats(
        selectedProfile.player_id,
      );

      if (!response.isSuccess || !response.result) {
        setProfileStats(null);
        setProfileStatsMessage(
          response.message || "This player's game stats are not available.",
        );
        return;
      }

      setProfileStats(response.result);
    } catch (error: any) {
      setProfileStats(null);
      setProfileStatsMessage(
        error.message || "Could not load game stats right now.",
      );
    } finally {
      setProfileStatsLoading(false);
    }
  };

  const renderProfileRow = (
    profile: FriendProfile,
    trailing?: ReactNode,
  ) => {
    const profileWithPresence = mergePresenceIntoProfile(profile);
    const name = getProfileName(profileWithPresence);
    const isOnline = canShowOnlineStatus(profileWithPresence);

    return (
      <TouchableOpacity
        key={profile.player_id}
        activeOpacity={0.85}
        onPress={() => openFriendProfile(profileWithPresence)}
      >
        <AppCard style={styles.rowCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowNameLine}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {name}
              </Text>
              {isOnline && <View style={styles.onlineDot} />}
            </View>
            {!!profile.friend_code && (
              <Text style={styles.rowSubtitle}>{profile.friend_code}</Text>
            )}
          </View>
          {trailing}
        </AppCard>
      </TouchableOpacity>
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
        <View style={styles.codeCardContent}>
          <View style={styles.codeTextBlock}>
            <Text style={styles.label}>Your friend code</Text>
            <Text style={styles.friendCode} numberOfLines={1}>
              {friendCode || "Not available yet"}
            </Text>
          </View>

          {friendCode && (
            <TouchableOpacity
              style={styles.qrPreviewButton}
              onPress={() => setQrModalVisible(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Enlarge friend QR code"
            >
              <FriendQrCode value={friendQrValue} size={74} />
            </TouchableOpacity>
          )}
        </View>
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

      <AppButton
        title="Scan Friend QR"
        onPress={openFriendScanner}
        variant="secondary"
        icon={<MaterialIcons name="qr-code-scanner" size={20} color={colors.tea[500]} />}
      />

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

  const renderActiveView = () => {
    switch (currentView) {
      case "add":
        return renderAddFriend();
      case "requests":
        return renderRequests();
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

      {renderFriendQrModal({
        friendCode,
        friendQrValue,
        visible: qrModalVisible,
        onClose: () => setQrModalVisible(false),
      })}

      <FriendProfileModal
        visible={profileModalVisible}
        loading={profileLoading}
        profile={selectedProfile}
        stats={profileStats}
        statsLoading={profileStatsLoading}
        statsMessage={profileStatsMessage}
        onLoadStats={loadProfileStats}
        onClose={() => {
          setProfileModalVisible(false);
          setSelectedProfile(null);
          setProfileStats(null);
          setProfileStatsMessage(null);
        }}
      />

      {renderFriendScanner({
        visible: scannerVisible,
        hasPermission: scannerPermission,
        scanned: scannerScanned,
        onClose: () => {
          setScannerVisible(false);
          setScannerScanned(false);
        },
        onScanned: handleFriendQrScanned,
      })}
    </View>
  );
}

function renderFriendQrModal({
  friendCode,
  friendQrValue,
  visible,
  onClose,
}: {
  friendCode: string | null;
  friendQrValue: string;
  visible: boolean;
  onClose: () => void;
}) {
  if (!friendCode) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
          <MaterialIcons name="close" size={30} color={colors.stone[100]} />
        </TouchableOpacity>

        <View style={styles.enlargedQrCard}>
          <FriendQrCode value={friendQrValue} size={250} />
          <Text style={styles.enlargedQrCode}>{friendCode}</Text>
        </View>

        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

function FriendProfileModal({
  visible,
  loading,
  profile,
  stats,
  statsLoading,
  statsMessage,
  onLoadStats,
  onClose,
}: {
  visible: boolean;
  loading: boolean;
  profile: FriendProfile | null;
  stats: FriendProfileStats | null;
  statsLoading: boolean;
  statsMessage: string | null;
  onLoadStats: () => void;
  onClose: () => void;
}) {
  const name = getProfileName(profile);
  const isOnline = canShowOnlineStatus(profile);
  const canViewStats = profile?.can_view_game_stats !== false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.profileModalContainer}>
        <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
          <MaterialIcons name="close" size={30} color={colors.stone[100]} />
        </TouchableOpacity>

        <AppCard style={styles.profileModalCard}>
          {loading ? (
            <View style={styles.profileLoading}>
              <ActivityIndicator color={colors.tea[500]} size="large" />
              <Text style={styles.profileLoadingText}>Loading profile...</Text>
            </View>
          ) : profile ? (
            <ScrollView contentContainerStyle={styles.profileModalContent}>
              <View style={styles.profileHero}>
                <View style={styles.profilePhotoLarge}>
                  {profile.profile_photo_url ? (
                    <AuthenticatedImage
                      photoUrl={profile.profile_photo_url}
                      style={styles.profilePhotoImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.profilePhotoInitials}>
                      {getInitials(name)}
                    </Text>
                  )}
                </View>

                <View style={styles.profileNameLine}>
                  <Text style={styles.profileName} selectable>
                    {name}
                  </Text>
                  {isOnline && <View style={styles.onlineDotLarge} />}
                </View>

                {isOnline && (
                  <Text style={styles.profileOnlineText}>Online now</Text>
                )}
              </View>

              <View style={styles.profileDetails}>
                <ProfileDetail label="Name" value={profile.player_name} />
                <ProfileDetail label="Email" value={profile.player_email} />
                <ProfileDetail label="Mobile" value={profile.player_mobile} />
                <ProfileDetail label="Friend Code" value={profile.friend_code} />
              </View>

              <View style={styles.statsSection}>
                <View style={styles.statsHeader}>
                  <Text style={styles.statsTitle}>Game Stats</Text>
                  {canViewStats && !stats && (
                    <TouchableOpacity
                      style={styles.statsButton}
                      onPress={onLoadStats}
                      disabled={statsLoading}
                    >
                      {statsLoading ? (
                        <ActivityIndicator color={colors.ink[900]} />
                      ) : (
                        <Text style={styles.statsButtonText}>View</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {!canViewStats ? (
                  <Text style={styles.statsMuted}>
                    This player has hidden their game stats.
                  </Text>
                ) : stats ? (
                  <StatsOverview stats={stats} />
                ) : statsMessage ? (
                  <Text style={styles.statsMuted}>{statsMessage}</Text>
                ) : (
                  <Text style={styles.statsMuted}>
                    View this player&apos;s win, loss, and draw overview.
                  </Text>
                )}
              </View>
            </ScrollView>
          ) : null}
        </AppCard>

        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

function StatsOverview({ stats }: { stats: FriendProfileStats }) {
  return (
    <View style={styles.statsOverview}>
      <View style={styles.statsTotalRow}>
        <Text style={styles.statsTotalLabel}>Games Played</Text>
        <Text style={styles.statsTotalValue}>{stats.games_played}</Text>
      </View>

      <StatsBar
        label="Won"
        count={stats.wins}
        percentage={stats.win_percentage}
        color={colors.tea[500]}
      />
      <StatsBar
        label="Lost"
        count={stats.losses}
        percentage={stats.loss_percentage}
        color={colors.red[500]}
      />
      <StatsBar
        label="Drawn"
        count={stats.draws}
        percentage={stats.draw_percentage}
        color={colors.peach[500]}
      />
    </View>
  );
}

function StatsBar({
  label,
  count,
  percentage,
  color,
}: {
  label: string;
  count: number;
  percentage: number;
  color: string;
}) {
  return (
    <View style={styles.statsBarGroup}>
      <View style={styles.statsBarLabelRow}>
        <Text style={styles.statsBarLabel}>{label}</Text>
        <Text style={styles.statsBarValue}>
          {percentage.toFixed(1)}% ({count})
        </Text>
      </View>
      <View style={styles.statsTrack}>
        <View
          style={[
            styles.statsFill,
            { backgroundColor: color, width: `${Math.min(100, percentage)}%` },
          ]}
        />
      </View>
    </View>
  );
}

function ProfileDetail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <View style={styles.profileDetailRow}>
      <Text style={styles.profileDetailLabel}>{label}</Text>
      <Text style={styles.profileDetailValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function FriendQrCode({
  value,
  size,
}: {
  value: string;
  size: number;
}) {
  const qr = useMemo(() => {
    const generatedQr = qrcodeGenerator(0, "M");
    generatedQr.addData(value);
    generatedQr.make();
    return generatedQr;
  }, [value]);
  const moduleCount = qr.getModuleCount();
  const moduleSize = Math.max(1, Math.floor(size / moduleCount));
  const actualSize = moduleSize * moduleCount;

  return (
    <View
      style={[
        styles.qrMatrix,
        {
          width: actualSize,
          height: actualSize,
        },
      ]}
    >
      {Array.from({ length: moduleCount }).map((_, row) => (
        <View key={`row-${row}`} style={styles.qrMatrixRow}>
          {Array.from({ length: moduleCount }).map((__, column) => (
            <View
              key={`${row}-${column}`}
              style={[
                styles.qrMatrixCell,
                {
                  width: moduleSize,
                  height: moduleSize,
                  backgroundColor: qr.isDark(row, column)
                    ? colors.ink[900]
                    : colors.stone[100],
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function renderFriendScanner({
  visible,
  hasPermission,
  scanned,
  onClose,
  onScanned,
}: {
  visible: boolean;
  hasPermission: boolean | null;
  scanned: boolean;
  onClose: () => void;
  onScanned: ({ data }: { data: string }) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.scannerContainer}>
        {hasPermission === false ? (
          <View style={styles.scannerPermissionCard}>
            <MaterialIcons
              name="camera-alt"
              size={44}
              color={colors.stone[400]}
            />
            <Text style={styles.emptyTitle}>Camera access required</Text>
            <Text style={styles.emptyBody}>
              Enable camera access in device settings to scan friend QR codes.
            </Text>
          </View>
        ) : (
          <CameraView
            onBarcodeScanned={scanned ? undefined : onScanned}
            style={styles.scannerCamera}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
          />
        )}

        <TouchableOpacity style={styles.scannerCloseButton} onPress={onClose}>
          <MaterialIcons name="close" size={28} color={colors.stone[100]} />
        </TouchableOpacity>

        {hasPermission !== false && (
          <>
            <View style={styles.scannerFrame} />
            <View style={styles.scannerHint}>
              <Text style={styles.scannerHintText}>Scan a friend QR code</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
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
  codeCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  codeTextBlock: {
    flex: 1,
    minWidth: 0,
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
  qrPreviewButton: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: colors.stone[100],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.tea[500],
  },
  qrMatrix: {
    backgroundColor: colors.stone[100],
  },
  qrMatrixRow: {
    flexDirection: "row",
  },
  qrMatrixCell: {
    backgroundColor: colors.stone[100],
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
    minWidth: 0,
  },
  rowNameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: "700",
    flexShrink: 1,
  },
  rowSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.tea[500],
    borderWidth: 1,
    borderColor: colors.stone[100],
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
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  modalCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 3,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  enlargedQrCard: {
    zIndex: 2,
    backgroundColor: colors.stone[100],
    borderRadius: 8,
    padding: 22,
    alignItems: "center",
  },
  enlargedQrCode: {
    ...typography.h2,
    color: colors.ink[900],
    marginTop: 16,
  },
  profileModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  profileModalCard: {
    zIndex: 2,
    width: "100%",
    maxWidth: 420,
    maxHeight: "78%",
    padding: 0,
    overflow: "hidden",
  },
  profileModalContent: {
    padding: 22,
    gap: 20,
  },
  profileLoading: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  profileLoadingText: {
    ...typography.small,
    color: colors.stone[300],
  },
  profileHero: {
    alignItems: "center",
    gap: 10,
  },
  profilePhotoLarge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: "hidden",
    backgroundColor: colors.ink[700],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.tea[500],
  },
  profilePhotoImage: {
    width: "100%",
    height: "100%",
  },
  profilePhotoInitials: {
    ...typography.h2,
    color: colors.tea[500],
  },
  profileNameLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  profileName: {
    ...typography.h2,
    textAlign: "center",
    flexShrink: 1,
  },
  onlineDotLarge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.tea[500],
    borderWidth: 1,
    borderColor: colors.stone[100],
  },
  profileOnlineText: {
    ...typography.small,
    color: colors.tea[500],
    fontWeight: "700",
  },
  profileDetails: {
    gap: 12,
  },
  statsSection: {
    gap: 12,
    paddingTop: 4,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statsTitle: {
    ...typography.h3,
  },
  statsButton: {
    minWidth: 72,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: colors.tea[500],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  statsButtonText: {
    ...typography.small,
    color: colors.ink[900],
    fontWeight: "800",
  },
  statsMuted: {
    ...typography.small,
    color: colors.stone[400],
  },
  statsOverview: {
    gap: 14,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.ink[700],
  },
  statsTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsTotalLabel: {
    ...typography.small,
    color: colors.stone[300],
    fontWeight: "700",
  },
  statsTotalValue: {
    ...typography.h3,
    color: colors.stone[100],
    fontVariant: ["tabular-nums"],
  },
  statsBarGroup: {
    gap: 6,
  },
  statsBarLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  statsBarLabel: {
    ...typography.small,
    color: colors.stone[100],
    fontWeight: "700",
  },
  statsBarValue: {
    ...typography.small,
    color: colors.stone[300],
    fontVariant: ["tabular-nums"],
  },
  statsTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ink[800],
    overflow: "hidden",
  },
  statsFill: {
    height: "100%",
    borderRadius: 5,
  },
  profileDetailRow: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.ink[700],
  },
  profileDetailLabel: {
    ...typography.caption,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 6,
  },
  profileDetailValue: {
    ...typography.body,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: colors.ink[900],
  },
  scannerCamera: {
    flex: 1,
  },
  scannerCloseButton: {
    position: "absolute",
    top: 54,
    right: 20,
    zIndex: 3,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.ink[800],
    borderWidth: 2,
    borderColor: colors.tea[400],
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    position: "absolute",
    top: "28%",
    left: "15%",
    width: "70%",
    height: "32%",
    borderWidth: 3,
    borderColor: colors.tea[400],
    borderRadius: 12,
    zIndex: 2,
  },
  scannerHint: {
    position: "absolute",
    bottom: 95,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 2,
  },
  scannerHintText: {
    ...typography.body,
    color: colors.stone[100],
    fontWeight: "700",
    textAlign: "center",
    backgroundColor: `${colors.ink[800]}CC`,
    borderColor: colors.tea[400],
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  scannerPermissionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
});
