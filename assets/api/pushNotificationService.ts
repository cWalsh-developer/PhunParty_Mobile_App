import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { notificationsApi } from "./notificationsApi";

interface PushRegistrationResult {
  registered: boolean;
  token?: string;
  message?: string;
}

export interface FriendNotificationEvent {
  type?: string;
  data: Record<string, any>;
}

type NotificationsModule = typeof import("expo-notifications");

let notificationsModulePromise: Promise<NotificationsModule> | null = null;
let notificationHandlerConfigured = false;

const getProjectId = () => {
  const constants = Constants as any;
  return (
    constants.expoConfig?.extra?.eas?.projectId ||
    constants.easConfig?.projectId ||
    constants.manifest2?.extra?.eas?.projectId
  );
};

const isRunningInExpoGo = () => {
  const constants = Constants as any;
  return (
    constants.appOwnership === "expo" ||
    constants.executionEnvironment === "storeClient"
  );
};

const loadNotificationsModule = async () => {
  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications").then((module) => {
      if (!notificationHandlerConfigured) {
        module.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        notificationHandlerConfigured = true;
      }

      return module;
    });
  }

  return notificationsModulePromise;
};

const getNotificationData = (content?: { data?: Record<string, any> | null }) =>
  content?.data || {};

const isFriendNotification = (data: Record<string, any>) =>
  data.type === "friend_request_received" ||
  data.type === "friend_request_accepted" ||
  typeof data.friend_request_id === "string";

export const pushNotificationService = {
  async registerForPushNotifications(): Promise<PushRegistrationResult> {
    if (isRunningInExpoGo()) {
      return {
        registered: false,
        message:
          "Remote push notifications require a development or production build. Expo Go cannot test this on Android.",
      };
    }

    if (!Device.isDevice) {
      return {
        registered: false,
        message: "Push notifications require a physical device.",
      };
    }

    const Notifications = await loadNotificationsModule();
    const existingPermission = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermission.status;

    if (finalStatus !== "granted") {
      const requestedPermission =
        await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermission.status;
    }

    if (finalStatus !== "granted") {
      return {
        registered: false,
        message: "Notification permission was not granted.",
      };
    }

    const projectId = getProjectId();
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    const response = await notificationsApi.registerPushToken({
      expo_push_token: token.data,
      device_id: Device.deviceName || null,
      platform: Platform.OS,
    });

    if (!response.isSuccess) {
      return {
        registered: false,
        message: response.message || "Could not save push token.",
      };
    }

    return {
      registered: true,
      token: token.data,
    };
  },

  async addFriendNotificationListeners(
    onSocialUpdate: (event: FriendNotificationEvent) => void,
  ): Promise<() => void> {
    if (isRunningInExpoGo()) {
      return () => {};
    }

    const Notifications = await loadNotificationsModule();

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = getNotificationData(notification.request.content);

        if (isFriendNotification(data)) {
          onSocialUpdate({
            type: typeof data.type === "string" ? data.type : undefined,
            data,
          });
        }
      },
    );

    const responseSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = getNotificationData(
          response.notification.request.content,
        );

        if (isFriendNotification(data)) {
          onSocialUpdate({
            type: typeof data.type === "string" ? data.type : undefined,
            data,
          });
        }
      });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  },
};
