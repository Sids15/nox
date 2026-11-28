package app.nox.widget

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The app → widget bridge, plus "Share to Nox".
 *
 * Widget: the app hands over a JSON snapshot of what the widget should show (built in JS from the
 * same settings as the desktop widget); it's stored on the device and the widget redraws from it.
 *
 * Share: when text or a link is shared to Nox from another app, the app asks for it with
 * takeSharedText() (on start) or hears "onShare" (when already open) and opens "Add to Nox".
 * Nothing is sent anywhere from here.
 */
class NoxWidgetModule : Module() {
  /** Shared text that arrived while the app was open, until the app takes it. */
  private var pending: String? = null

  private fun sharedText(intent: Intent?): String? {
    if (intent == null || intent.action != Intent.ACTION_SEND) return null
    if (intent.type?.startsWith("text/") != true) return null
    val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim().orEmpty()
    val out = if (text.isNotEmpty()) text else subject
    return out.takeIf { it.isNotEmpty() }?.take(4000)
  }

  override fun definition() = ModuleDefinition {
    Name("NoxWidget")

    Events("onShare")

    Function("setSnapshot") { json: String ->
      val context = appContext.reactContext ?: return@Function false
      NoxWidgetProvider.store(context, json)
      NoxWidgetProvider.refreshAll(context)
      true
    }

    Function("clear") {
      val context = appContext.reactContext ?: return@Function false
      NoxWidgetProvider.store(context, null)
      NoxWidgetProvider.refreshAll(context)
      true
    }

    /** What was shared to Nox (the launch intent, or one received since), once; then null. */
    Function("takeSharedText") {
      val waiting = pending
      pending = null
      if (waiting != null) return@Function waiting
      val activity = appContext.currentActivity ?: return@Function null
      val text = sharedText(activity.intent)
      if (text != null) {
        // Taken: don't offer the same share again when the app comes back.
        activity.intent = Intent(Intent.ACTION_MAIN)
      }
      text
    }

    OnNewIntent { intent ->
      val text = sharedText(intent) ?: return@OnNewIntent
      pending = text
      sendEvent("onShare", mapOf("text" to text))
    }
  }
}
