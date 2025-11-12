import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";

const isExpoGo = Constants.appOwnership === "expo";

export async function registerForPushNotificationsAsync(): Promise<boolean> {
  // Expo Go on Android: remote push isn’t supported. We can still do locals.
  if (Platform.OS === "android") {
    // Safe to set the channel in Expo Go (for local notifications sound/importance)
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // If you ever add getExpoPushTokenAsync, guard it by !isExpoGo
  // if (!isExpoGo) {
  //   const token = await Notifications.getExpoPushTokenAsync({ projectId: "<your-project-id>" });
  //   console.log("Expo push token:", token.data);
  // }

  // In Expo Go on Android, remote push won’t work; but local notifications will.
  return finalStatus === "granted";
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  date: Date,
  repeat: "none" | "daily" | "weekly" | "monthly" = "none"
) {
  let trigger: Notifications.NotificationTriggerInput;

  if (repeat === "daily") {
    trigger = { type: "calendar", hour: date.getHours(), minute: date.getMinutes(), repeats: true } as any;
  } else if (repeat === "weekly") {
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    trigger = { type: "calendar", weekday, hour: date.getHours(), minute: date.getMinutes(), repeats: true } as any;
  } else if (repeat === "monthly") {
    const nextMonth = new Date(date);
    nextMonth.setMonth(date.getMonth() + 1);
    const diffSeconds = Math.max(60, Math.floor((nextMonth.getTime() - Date.now()) / 1000));
    trigger = { type: "timeInterval", seconds: diffSeconds, repeats: true } as any;
  } else {
    const diffSeconds = Math.max(1, Math.floor((date.getTime() - Date.now()) / 1000));
    trigger = { type: "timeInterval", seconds: diffSeconds, repeats: false } as any;
  }

  return await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger,
  });
}
