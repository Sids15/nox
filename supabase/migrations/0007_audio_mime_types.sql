-- 0007: widen the `audio` bucket's allowed_mime_types to cover what a browser can actually record.
--
-- The web target records via MediaRecorder, which on Chromium (and therefore WebView2, and therefore
-- the Tauri desktop shell) may only offer Opus in a WebM container. Storage matches Content-Type
-- against allowed_mime_types exactly, so a WebM upload was rejected outright — surfacing as a voice
-- note that records fine and then silently never syncs. The client prefers audio/mp4 when the browser
-- supports it, because Opus/WebM does not play on iOS; these are the fallbacks.
--
-- Also resolves the TODO left in 0003: expo-audio infers `audio/x-m4a` in some cases and the
-- non-standard `audio/m4a` alone would reject those uploads.

update storage.buckets
set allowed_mime_types = array[
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
  'audio/webm',
  'audio/ogg'
]
where id = 'audio';
