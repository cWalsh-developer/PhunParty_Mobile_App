const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");

const PACKAGE_PATH = path.join("com", "phunparty", "mobileapp");
const MODULE_FILE = "FairPlayWindowModeModule.kt";
const PACKAGE_FILE = "FairPlayWindowModePackage.kt";

const moduleSource = `package com.phunparty.mobileapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class FairPlayWindowModeModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  init {
    sharedReactContext = reactContext
    registerSystemDialogReceiver(reactContext)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun isInMultiWindowMode(promise: Promise) {
    promise.resolve(getCurrentMultiWindowMode())
  }

  @ReactMethod
  fun isInPictureInPictureMode(promise: Promise) {
    promise.resolve(getCurrentPictureInPictureMode())
  }

  @ReactMethod
  fun hasWindowFocus(promise: Promise) {
    promise.resolve(getCurrentWindowFocus())
  }

  @ReactMethod
  fun isTopResumedActivity(promise: Promise) {
    promise.resolve(lastKnownTopResumedActivity)
  }

  @ReactMethod
  fun getActivityState(promise: Promise) {
    promise.resolve(lastKnownActivityState)
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  companion object {
    const val NAME = "FairPlayWindowMode"
    private const val EVENT_NAME = "FairPlayWindowModeChanged"
    private var sharedReactContext: ReactApplicationContext? = null

    private var lastKnownMultiWindowMode: Boolean = false
    private var lastKnownPictureInPictureMode: Boolean = false
    private var lastKnownWindowFocus: Boolean = true
    private var lastKnownTopResumedActivity: Boolean = true
    private var lastUserLeaveHintAtMs: Double = 0.0
    private var lastKnownActivityState: String = "resumed"
    private var lastSystemDialogReason: String? = null

    private var systemDialogReceiverRegistered: Boolean = false

    private fun getCurrentMultiWindowMode(): Boolean {
      val activity = sharedReactContext?.currentActivity
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        activity?.isInMultiWindowMode ?: lastKnownMultiWindowMode
      } else {
        lastKnownMultiWindowMode
      }
    }

    private fun getCurrentPictureInPictureMode(): Boolean {
      val activity = sharedReactContext?.currentActivity
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        activity?.isInPictureInPictureMode ?: lastKnownPictureInPictureMode
      } else {
        lastKnownPictureInPictureMode
      }
    }

    private fun getCurrentWindowFocus(): Boolean {
      val activity = sharedReactContext?.currentActivity
      return activity?.window?.decorView?.hasWindowFocus() ?: lastKnownWindowFocus
    }

    fun setMultiWindowMode(isInMultiWindowMode: Boolean) {
      lastKnownMultiWindowMode = isInMultiWindowMode
      emitWindowModeChanged(eventSource = "multi_window_changed")
    }

    fun setPictureInPictureMode(isInPictureInPictureMode: Boolean) {
      lastKnownPictureInPictureMode = isInPictureInPictureMode
      emitWindowModeChanged(eventSource = "picture_in_picture_changed")
    }

    fun setWindowFocus(hasWindowFocus: Boolean) {
      lastKnownWindowFocus = hasWindowFocus
      emitWindowModeChanged(eventSource = "window_focus_changed")
    }

    fun setTopResumedActivity(isTopResumedActivity: Boolean) {
      lastKnownTopResumedActivity = isTopResumedActivity
      emitWindowModeChanged(eventSource = "top_resumed_changed")
    }

    fun noteUserLeaveHint() {
      lastUserLeaveHintAtMs = System.currentTimeMillis().toDouble()
      emitWindowModeChanged(userLeaveHint = true, eventSource = "user_leave_hint")
    }

    fun noteSystemDialogReason(reason: String?) {
      lastSystemDialogReason = reason

      if (
        reason == "recentapps" ||
        reason == "homekey" ||
        reason == "lock"
      ) {
        lastUserLeaveHintAtMs = System.currentTimeMillis().toDouble()
      }

      emitWindowModeChanged(eventSource = "system_dialog_closed")
    }

    fun setActivityState(activityState: String) {
      lastKnownActivityState = activityState
      emitWindowModeChanged(
        activityState = activityState,
        eventSource = "activity_state_changed"
      )
    }

    private fun emitWindowModeChanged(
      userLeaveHint: Boolean = false,
      activityState: String? = null,
      eventSource: String = "snapshot"
    ) {
      val context = sharedReactContext ?: return

      val payload = Arguments.createMap().apply {
        putBoolean("isInMultiWindowMode", getCurrentMultiWindowMode())
        putBoolean("isInPictureInPictureMode", getCurrentPictureInPictureMode())
        putBoolean("hasWindowFocus", getCurrentWindowFocus())
        putBoolean("isTopResumedActivity", lastKnownTopResumedActivity)
        putBoolean("userLeaveHint", userLeaveHint)
        putDouble("userLeaveHintAtMs", lastUserLeaveHintAtMs)
        putString("activityState", activityState ?: lastKnownActivityState)
        putString("eventSource", eventSource)
        lastSystemDialogReason?.let { putString("systemDialogReason", it) }
      }

      try {
        context
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_NAME, payload)
      } catch (_: Exception) {
        // The JS bridge may not be ready during startup/shutdown.
      }
    }

    fun registerSystemDialogReceiver(context: Context) {
      if (systemDialogReceiverRegistered) {
        return
      }

      val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (intent?.action != Intent.ACTION_CLOSE_SYSTEM_DIALOGS) {
            return
          }

          noteSystemDialogReason(intent.getStringExtra("reason"))
        }
      }

      try {
        val filter = IntentFilter(Intent.ACTION_CLOSE_SYSTEM_DIALOGS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
          context.registerReceiver(receiver, filter)
        }
        systemDialogReceiverRegistered = true
      } catch (_: Exception) {
        // Some Android versions restrict system-dialog broadcasts.
      }
    }
  }
}
`;

const packageSource = `package com.phunparty.mobileapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class FairPlayWindowModePackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(FairPlayWindowModeModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
`;

const ensureImport = (source, importLine) => {
  if (source.includes(importLine)) {
    return source;
  }

  return source.replace(
    /(package com\.phunparty\.mobileapp\s*)/,
    `$1\n${importLine}\n`,
  );
};

const ensureMainActivityOverrides = (source) => {
  const hasMultiWindowOverride = source.includes(
    "FairPlayWindowModeModule.setMultiWindowMode",
  );

  const hasPictureInPictureOverride = source.includes(
    "FairPlayWindowModeModule.setPictureInPictureMode",
  );

  const hasWindowFocusOverride = source.includes(
    "FairPlayWindowModeModule.setWindowFocus",
  );

  const hasTopResumedOverride = source.includes(
    "FairPlayWindowModeModule.setTopResumedActivity",
  );

  const hasUserLeaveHintOverride = source.includes(
    "FairPlayWindowModeModule.noteUserLeaveHint",
  );

  const hasActivityStateOverride = source.includes(
    "FairPlayWindowModeModule.setActivityState",
  );

  const overrideBlocks = [];

  if (!hasMultiWindowOverride) {
    overrideBlocks.push(`
  override fun onMultiWindowModeChanged(isInMultiWindowMode: Boolean) {
    super.onMultiWindowModeChanged(isInMultiWindowMode)
    FairPlayWindowModeModule.setMultiWindowMode(isInMultiWindowMode)
  }

  override fun onMultiWindowModeChanged(
    isInMultiWindowMode: Boolean,
    newConfig: Configuration
  ) {
    super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig)
    FairPlayWindowModeModule.setMultiWindowMode(isInMultiWindowMode)
  }
`);
  }

  if (!hasPictureInPictureOverride) {
    overrideBlocks.push(`
  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode)
    FairPlayWindowModeModule.setPictureInPictureMode(isInPictureInPictureMode)
  }

  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: Configuration
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    FairPlayWindowModeModule.setPictureInPictureMode(isInPictureInPictureMode)
  }
`);
  }

  if (!hasWindowFocusOverride) {
    overrideBlocks.push(`
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    FairPlayWindowModeModule.setWindowFocus(hasFocus)
  }
`);
  }

  if (!hasTopResumedOverride) {
    overrideBlocks.push(`
  override fun onTopResumedActivityChanged(isTopResumedActivity: Boolean) {
    super.onTopResumedActivityChanged(isTopResumedActivity)
    FairPlayWindowModeModule.setTopResumedActivity(isTopResumedActivity)
  }
`);
  }

  if (!hasUserLeaveHintOverride) {
    overrideBlocks.push(`
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    FairPlayWindowModeModule.noteUserLeaveHint()
  }
`);
  }

  if (!hasActivityStateOverride) {
    overrideBlocks.push(`
  override fun onResume() {
    super.onResume()
    FairPlayWindowModeModule.setActivityState("resumed")
  }

  override fun onPause() {
    FairPlayWindowModeModule.setActivityState("paused")
    super.onPause()
  }

  override fun onStop() {
    FairPlayWindowModeModule.setActivityState("stopped")
    super.onStop()
  }
`);
  }

  if (overrideBlocks.length === 0) {
    return source;
  }

  const overrides = `${overrideBlocks.join("\n")}\n`;

  if (source.includes("override fun onCreate")) {
    return source.replace(
      /\n  override fun onCreate/,
      `${overrides}\n  override fun onCreate`,
    );
  }

  if (source.includes("class MainActivity")) {
    return source.replace(/\n}/, `${overrides}\n}`);
  }

  return source;
};

const ensureMainApplicationPackage = (source) => {
  const importLine = "import com.phunparty.mobileapp.FairPlayWindowModePackage";
  let nextSource = ensureImport(source, importLine);

  const packageRegistration = "add(FairPlayWindowModePackage())";

  if (nextSource.includes(packageRegistration)) {
    return nextSource;
  }

  const manualPackageCommentRegex =
    /(\s+\/\/ Packages that cannot be autolinked yet can be added manually here, for example:\n\s+\/\/ add\(MyReactNativePackage\(\)\))/;

  if (manualPackageCommentRegex.test(nextSource)) {
    return nextSource.replace(
      manualPackageCommentRegex,
      `$1\n          ${packageRegistration}`,
    );
  }

  const packagesListRegex =
    /(val packages = PackageList\(this\)\.packages\s*\n\s*\/\/ Packages that cannot be autolinked yet can be added manually here, for example:\s*\n\s*\/\/ packages\.add\(MyReactNativePackage\(\)\))/;

  if (packagesListRegex.test(nextSource)) {
    return nextSource.replace(
      packagesListRegex,
      `$1\n        packages.${packageRegistration}`,
    );
  }

  const returnPackagesRegex = /(return packages\s*\n\s*})/;

  if (returnPackagesRegex.test(nextSource)) {
    return nextSource.replace(
      returnPackagesRegex,
      `packages.${packageRegistration}\n        $1`,
    );
  }

  return nextSource;
};

const writeNativeFiles = (androidRoot) => {
  const packageRoot = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "java",
    ...PACKAGE_PATH.split(path.sep),
  );

  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(path.join(packageRoot, MODULE_FILE), moduleSource);
  fs.writeFileSync(path.join(packageRoot, PACKAGE_FILE), packageSource);
};

const updateNativeEntrypoints = (androidRoot) => {
  const packageRoot = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "java",
    ...PACKAGE_PATH.split(path.sep),
  );

  const mainActivityPath = path.join(packageRoot, "MainActivity.kt");
  const mainApplicationPath = path.join(packageRoot, "MainApplication.kt");

  if (fs.existsSync(mainActivityPath)) {
    let mainActivitySource = fs.readFileSync(mainActivityPath, "utf8");

    mainActivitySource = ensureImport(
      mainActivitySource,
      "import android.content.res.Configuration",
    );

    mainActivitySource = ensureMainActivityOverrides(mainActivitySource);

    fs.writeFileSync(mainActivityPath, mainActivitySource);
  }

  if (fs.existsSync(mainApplicationPath)) {
    let mainApplicationSource = fs.readFileSync(mainApplicationPath, "utf8");
    mainApplicationSource = ensureMainApplicationPackage(mainApplicationSource);
    fs.writeFileSync(mainApplicationPath, mainApplicationSource);
  }
};

const withAndroidFairPlayWindowMode = (config) => {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (application) {
      application.$["android:resizeableActivity"] = "false";
    }

    const mainActivity = application?.activity?.find((activity) =>
      activity["intent-filter"]?.some((filter) =>
        filter.action?.some(
          (action) => action.$["android:name"] === "android.intent.action.MAIN",
        ),
      ),
    );

    if (mainActivity) {
      mainActivity.$["android:resizeableActivity"] = "false";
      mainActivity.$["android:supportsPictureInPicture"] = "false";
    }

    return config;
  });

  config = withDangerousMod(config, [
    "android",
    (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;

      writeNativeFiles(androidRoot);
      updateNativeEntrypoints(androidRoot);

      return config;
    },
  ]);

  return config;
};

module.exports = withAndroidFairPlayWindowMode;
