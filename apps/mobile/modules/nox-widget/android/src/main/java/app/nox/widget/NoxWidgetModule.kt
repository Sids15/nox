package app.nox.widget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The app → widget bridge. The app hands over a JSON snapshot of what the widget should show
 * (built in JS from the same settings as the desktop widget); it's stored on the device and the
 * widget redraws from it. No network access, nothing leaves the phone.
 */
class NoxWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NoxWidget")

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
  }
}
