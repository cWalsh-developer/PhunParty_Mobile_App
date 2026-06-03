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
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun isInMultiWindowMode(promise: Promise) {
    val activity = reactContext.currentActivity
    val isInMultiWindowMode =
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.N &&
        activity?.isInMultiWindowMode == true

    promise.resolve(isInMultiWindowMode)
  }

  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Int) = Unit

  companion object {
    const val NAME = "FairPlayWindowMode"
    private const val EVENT_NAME = "FairPlayWindowModeChanged"
    private var sharedReactContext: ReactApplicationContext? = null

    fun emitMultiWindowModeChanged(isInMultiWindowMode: Boolean) {
      val context = sharedReactContext ?: return
      val payload = Arguments.createMap().apply {
        putBoolean("isInMultiWindowMode", isInMultiWindowMode)
      }

      try {
        context
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_NAME, payload)
      } catch (_: Exception) {
        // The JS bridge may not be ready during startup/shutdown.
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
  if (source.includes("FairPlayWindowModeModule.emitMultiWindowModeChanged")) {
    return source;
  }

  const overrides = `
  override fun onMultiWindowModeChanged(isInMultiWindowMode: Boolean) {
    super.onMultiWindowModeChanged(isInMultiWindowMode)
    FairPlayWindowModeModule.emitMultiWindowModeChanged(isInMultiWindowMode)
  }

  override fun onMultiWindowModeChanged(
    isInMultiWindowMode: Boolean,
    newConfig: Configuration
  ) {
    super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig)
    FairPlayWindowModeModule.emitMultiWindowModeChanged(isInMultiWindowMode)
  }

`;

  return source.replace(
    /\n  \/\*\*\n    \* Align the back button behavior/,
    `\n${overrides}  /**\n    * Align the back button behavior`,
  );
};

const ensureMainApplicationPackage = (source) => {
  const packageRegistration = "add(FairPlayWindowModePackage())";

  if (source.includes(packageRegistration)) {
    return source;
  }

  return source.replace(
    /(\s+\/\/ Packages that cannot be autolinked yet can be added manually here, for example:\n\s+\/\/ add\(MyReactNativePackage\(\)\))/,
    `$1\n          ${packageRegistration}`,
  );
};

const writeNativeFiles = (androidRoot) => {
  const packageRoot = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "java",
    PACKAGE_PATH,
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
    PACKAGE_PATH,
  );
  const mainActivityPath = path.join(packageRoot, "MainActivity.kt");
  const mainApplicationPath = path.join(packageRoot, "MainApplication.kt");

  if (fs.existsSync(mainActivityPath)) {
    const updatedMainActivity = ensureMainActivityOverrides(
      ensureImport(
        fs.readFileSync(mainActivityPath, "utf8"),
        "import android.content.res.Configuration",
      ),
    );
    fs.writeFileSync(mainActivityPath, updatedMainActivity);
  }

  if (fs.existsSync(mainApplicationPath)) {
    fs.writeFileSync(
      mainApplicationPath,
      ensureMainApplicationPackage(
        fs.readFileSync(mainApplicationPath, "utf8"),
      ),
    );
  }
};

module.exports = function withAndroidFairPlayWindowMode(config) {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];

    if (application) {
      application.$["android:resizeableActivity"] = "false";

      const mainActivity = application.activity?.find((activity) =>
        activity["intent-filter"]?.some((filter) =>
          filter.action?.some(
            (action) =>
              action.$["android:name"] === "android.intent.action.MAIN",
          ),
        ),
      );

      if (mainActivity) {
        mainActivity.$["android:resizeableActivity"] = "false";
        mainActivity.$["android:supportsPictureInPicture"] = "false";
      }
    }

    return config;
  });

  return withDangerousMod(config, [
    "android",
    (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;
      writeNativeFiles(androidRoot);
      updateNativeEntrypoints(androidRoot);
      return config;
    },
  ]);
};
