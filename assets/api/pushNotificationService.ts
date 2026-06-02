import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { notificationsApi } from "./notificationsApi";

interface PushRegistrationResult {
  registered: boolean;
  token?: string;
  message?: string;
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

    await notificationsApi.registerPushToken({
      expo_push_token: token.data,
      device_id: Device.deviceName || null,
      platform: Platform.OS,
    });

    return {
      registered: true,
      token: token.data,
    };
  },
};
