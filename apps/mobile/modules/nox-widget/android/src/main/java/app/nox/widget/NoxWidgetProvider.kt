package app.nox.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Nox's home-screen widget. Draws the snapshot the app last stored (see NoxWidgetModule): the
 * sections the user picked in Settings → Widget, in their order. Tapping a task, note or space opens
 * it in the app through its nox:// link; tapping anywhere else opens the app.
 */
class NoxWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) manager.updateAppWidget(id, render(context))
  }

  companion object {
    private const val PREFS = "nox_widget"
    private const val KEY = "snapshot"
    private const val MAX_ROWS = 14

    fun store(context: Context, json: String?) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
        if (json == null) remove(KEY) else putString(KEY, json)
      }.apply()
    }

    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, NoxWidgetProvider::class.java))
      if (ids.isNotEmpty()) for (id in ids) manager.updateAppWidget(id, render(context))
    }

    private fun color(hex: String?, fallback: String): Int =
      try { Color.parseColor(hex ?: fallback) } catch (_: IllegalArgumentException) { Color.parseColor(fallback) }

    private var requestCode = 0

    private fun open(context: Context, link: String?): PendingIntent {
      val intent = if (link != null) {
        Intent(Intent.ACTION_VIEW, Uri.parse(link)).setPackage(context.packageName)
      } else {
        context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      return PendingIntent.getActivity(
        context,
        requestCode++,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    fun render(context: Context): RemoteViews {
      requestCode = 0
      val views = RemoteViews(context.packageName, R.layout.nox_widget)
      views.removeAllViews(R.id.widget_body)
      views.setOnClickPendingIntent(R.id.widget_root, open(context, null))

      val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
      val snap = try { raw?.let { JSONObject(it) } } catch (_: Exception) { null }
      val dark = snap?.optString("theme") == "dark"
      val colors = snap?.optJSONObject("colors")
      val ink = color(colors?.optString("ink"), if (dark) "#F2EFE8" else "#1B2131")
      val ink3 = color(colors?.optString("ink3"), if (dark) "#8C8898" else "#8A8578")
      val accent = color(colors?.optString("accent"), "#D9472B")

      views.setInt(R.id.widget_root, "setBackgroundResource", if (dark) R.drawable.nox_widget_bg_dark else R.drawable.nox_widget_bg_light)
      views.setTextColor(R.id.widget_title, ink)
      views.setTextColor(R.id.widget_date, ink3)
      views.setTextViewText(R.id.widget_date, SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(Date()))

      var rows = 0
      fun heading(text: String) {
        if (rows >= MAX_ROWS) return
        val h = RemoteViews(context.packageName, R.layout.nox_widget_heading)
        h.setTextViewText(R.id.text, text.uppercase(Locale.getDefault()))
        h.setTextColor(R.id.text, ink3)
        views.addView(R.id.widget_body, h)
        rows++
      }
      fun row(mark: String, text: String, meta: String?, link: String?, faded: Boolean = false, markAccent: Boolean = false) {
        if (rows >= MAX_ROWS) return
        val r = RemoteViews(context.packageName, R.layout.nox_widget_row)
        r.setTextViewText(R.id.mark, mark)
        r.setTextColor(R.id.mark, if (markAccent) accent else ink3)
        r.setTextViewText(R.id.text, text)
        r.setTextColor(R.id.text, if (faded) ink3 else ink)
        r.setTextViewText(R.id.meta, meta ?: "")
        r.setTextColor(R.id.meta, if (markAccent) accent else ink3)
        r.setOnClickPendingIntent(R.id.row, open(context, link))
        views.addView(R.id.widget_body, r)
        rows++
      }

      if (snap == null) {
        row("", "Open Nox once to fill this in.", null, null, faded = true)
        return views
      }

      val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
      val stale = snap.optString("date") != today
      val sections = snap.optJSONArray("sections")
      if (sections == null || sections.length() == 0) {
        row("", "Pick what to show in Nox → Settings → Widget.", null, null, faded = true)
        return views
      }

      for (i in 0 until sections.length()) {
        val s = sections.optJSONObject(i) ?: continue
        when (s.optString("kind")) {
          "today" -> {
            val total = s.optInt("total")
            heading(if (total > 0) "Today · ${s.optInt("done")}/$total" else "Today")
            val items = s.optJSONArray("items")
            if (items == null || items.length() == 0) row("", "Nothing left today.", null, null, faded = true)
            else for (j in 0 until items.length()) {
              val t = items.optJSONObject(j) ?: continue
              val done = t.optBoolean("done")
              row(if (done) "✓" else "○", t.optString("title"), t.optString("time").takeIf { it.isNotEmpty() && it != "null" }, "nox://task/${t.optString("id")}", faded = done, markAccent = done)
            }
            val more = s.optInt("more")
            if (more > 0) row("", "+$more more", null, "nox://tasks", faded = true)
          }
          "next" -> {
            heading("Up next")
            val items = s.optJSONArray("items")
            if (items == null || items.length() == 0) row("", "Nothing else at a set time today.", null, null, faded = true)
            else for (j in 0 until items.length()) {
              val t = items.optJSONObject(j) ?: continue
              row("•", t.optString("title"), t.optString("time"), "nox://task/${t.optString("id")}", markAccent = true)
            }
          }
          "capture" -> row("+", "Add a task", null, "nox://tasks", markAccent = true)
          "space" -> {
            heading(s.optString("name"))
            val stages = s.optJSONArray("stages")
            val parts = mutableListOf<String>()
            if (stages != null) for (j in 0 until stages.length()) {
              val st = stages.optJSONObject(j) ?: continue
              parts.add("${st.optString("name")} ${st.optInt("count")}")
            }
            row("", if (parts.isEmpty()) "${s.optInt("pages")} pages" else parts.joinToString("  ·  "), null, "nox://space/${s.optString("spaceId")}")
          }
          "pinned" -> {
            heading("Pinned")
            val items = s.optJSONArray("items")
            if (items == null || items.length() == 0) row("", "Pin a note to see it here.", null, null, faded = true)
            else for (j in 0 until items.length()) {
              val n = items.optJSONObject(j) ?: continue
              row("▤", n.optString("title"), null, "nox://note/${n.optString("id")}")
            }
          }
        }
      }
      if (stale) row("", "Open Nox to refresh today's list.", null, null, faded = true)
      return views
    }
  }
}
