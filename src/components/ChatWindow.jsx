import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { trackEvent } from '../lib/analytics'
import { formatDayLabel, formatTimeOnly } from '../lib/timezone'
import { displayName } from '../lib/names'
import { useCall } from '../context/CallContext'

export default function ChatWindow({ conversation, myId, myName, myRole, memberNames }) {
  const { placeCall } = useCall()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [otherMembers, setOtherMembers] = useState([])
  const [onlineIds, setOnlineIds] = useState(new Set())
  const [rosterOpen, setRosterOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState(null)
  const [incomingCallFrom, setIncomingCallFrom] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [safetyBusy, setSafetyBusy] = useState(false)
  const [safetyError, setSafetyError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [signedUrls, setSignedUrls] = useState({})
  const [attaching, setAttaching] = useState(false)
  const [sendError, setSendError] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordPaused, setRecordPaused] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const recordCancelledRef = useRef(false)
  const channelRef = useRef(null)

  const otherMemberIds = otherMembers.map((m) => m.id)
  const nameById = Object.fromEntries(otherMembers.map((m) => [m.id, displayName(m, myRole)]))

  useEffect(() => {
    if (!conversation) return
    let active = true
    setLoading(true)
    setVideoUrl(null)
    setIncomingCallFrom(null)
    setMenuOpen(false)
    setRosterOpen(false)
    setReportOpen(false)
    setReportReason('')
    setSafetyError('')
    setBlocked(false)
    setSendError('')
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      recordCancelledRef.current = true
      mediaRecorderRef.current.stop()
    }
    clearInterval(recordTimerRef.current)
    setRecording(false)
    setRecordPaused(false)
    setRecordSeconds(0)

    async function loadMessages() {
      // RLS already excludes rows this user has "deleted for me" — see the
      // messages SELECT policy in 20260906010000_delete_for_me.sql.
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
      if (active) {
        setMessages(data || [])
        setLoading(false)
      }
    }
    loadMessages()

    async function loadMembers() {
      const { data } = await supabase
        .from('conversation_members')
        .select('user_id, profiles(full_name, username, role, avatar_emoji, avatar_url)')
        .eq('conversation_id', conversation.id)
        .neq('user_id', myId)
      const members = (data || []).map((m) => ({
        id: m.user_id,
        full_name: m.profiles?.full_name || 'Someone',
        username: m.profiles?.username,
        role: m.profiles?.role,
        avatar_emoji: m.profiles?.avatar_emoji,
        avatar_url: m.profiles?.avatar_url,
      }))
      if (active) setOtherMembers(members)

      if (members.length === 1) {
        const { data: blockRow } = await supabase
          .from('blocked_users')
          .select('blocked_id')
          .eq('blocker_id', myId)
          .eq('blocked_id', members[0].id)
          .maybeSingle()
        if (active) setBlocked(Boolean(blockRow))
      }
    }
    loadMembers()

    // A presence key of myId (instead of Realtime's default random key) means
    // channel.presenceState()'s keys are directly the online users' IDs.
    const channel = supabase
      .channel(`messages:${conversation.id}`, { config: { presence: { key: myId } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .on('presence', { event: 'sync' }, () => {
        if (active) setOnlineIds(new Set(Object.keys(channel.presenceState())))
      })
      // Real-time "someone started a call" signal for whoever else has this
      // conversation open right now — a broadcast, not a DB row, since it's
      // purely ephemeral (the persistent notification below covers anyone
      // who isn't currently looking at this chat).
      .on('broadcast', { event: 'video_call_started' }, ({ payload }) => {
        if (active) setIncomingCallFrom(payload.callerName)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ online_at: new Date().toISOString() })
      })

    channelRef.current = channel

    return () => {
      active = false
      channelRef.current = null
      supabase.removeChannel(channel)
    }
  }, [conversation?.id, myId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Attachments live in a private bucket — a signed URL is fetched once per
  // attachment path and cached, rather than re-signed on every render.
  useEffect(() => {
    const missing = messages.filter((m) => m.attachment_url && !signedUrls[m.attachment_url])
    if (missing.length === 0) return
    let active = true
    Promise.all(
      missing.map(async (m) => {
        const { data } = await supabase.storage.from('chat-attachments').createSignedUrl(m.attachment_url, 3600)
        return [m.attachment_url, data?.signedUrl]
      })
    ).then((pairs) => {
      if (!active) return
      setSignedUrls((prev) => ({ ...prev, ...Object.fromEntries(pairs.filter(([, url]) => url)) }))
    })
    return () => {
      active = false
    }
  }, [messages, signedUrls])

  // Queue an emailed notification for everyone else in the conversation —
  // send-notification-email decides whether they're actually offline enough
  // to bother emailing.
  async function notifyOthers(preview) {
    if (otherMemberIds.length === 0) return
    await supabase.from('events').insert(
      otherMemberIds.map((userId) => ({
        user_id: userId,
        type: 'new_message',
        payload: { conversation_id: conversation.id, sender_name: myName || 'Someone', preview },
      }))
    )
  }

  async function sendMessage(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    setDraft('')
    setSendError('')
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: myId,
      content,
    })
    if (error) {
      setSendError(error.message)
      setDraft(content)
      return
    }
    await notifyOthers(content.length > 140 ? `${content.slice(0, 140)}…` : content)
    trackEvent('Message Sent')
  }

  function attachmentTypeFor(mimeType) {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    return 'file'
  }

  async function uploadAndSendAttachment(file, { content, previewLabel }) {
    setSendError('')
    const path = `${conversation.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file)
    if (uploadError) {
      setSendError(uploadError.message)
      return false
    }

    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: myId,
      content,
      attachment_url: path,
      attachment_type: attachmentTypeFor(file.type),
    })
    if (insertError) {
      setSendError(insertError.message)
      return false
    }
    await notifyOthers(previewLabel)
    trackEvent('Message Sent', { attachment: true })
    return true
  }

  async function sendAttachment(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAttaching(true)
    await uploadAndSendAttachment(file, { content: file.name, previewLabel: `📎 ${file.name}` })
    setAttaching(false)
  }

  async function startRecording() {
    setSendError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordedChunksRef.current = []
      recordCancelledRef.current = false
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        clearInterval(recordTimerRef.current)
        setRecordSeconds(0)
        setRecordPaused(false)
        if (recordCancelledRef.current) return
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' })
        setAttaching(true)
        await uploadAndSendAttachment(file, { content: 'Voice message', previewLabel: '🎤 Voice message' })
        setAttaching(false)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecordPaused(false)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } catch {
      setSendError('Could not access your microphone — check your browser permissions.')
    }
  }

  // Sends what's been recorded so far.
  function stopRecording() {
    recordCancelledRef.current = false
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  // Discards the recording entirely — same stop() call, but onstop checks
  // this flag and skips the upload.
  function cancelRecording() {
    recordCancelledRef.current = true
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  function togglePauseRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recordPaused) {
      recorder.resume()
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } else {
      recorder.pause()
      clearInterval(recordTimerRef.current)
    }
    setRecordPaused((p) => !p)
  }

  // Removes it from only this user's view — the other participant(s) still
  // see it. Uses an RPC rather than a direct update() since Postgres RLS has
  // no column-level granularity to restrict which columns a member can touch.
  async function deleteForMe(message) {
    const { error } = await supabase.rpc('hide_message_for_me', { target_message_id: message.id })
    if (error) {
      setSendError(error.message)
      return
    }
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
  }

  // Actually removes the row — sender-only (enforced by the delete policy),
  // and via the DELETE realtime subscription above it disappears for the
  // other participant(s) too.
  async function deleteForEveryone(message) {
    if (!confirm('Delete this message for everyone? This cannot be undone.')) return
    if (message.attachment_url) {
      await supabase.storage.from('chat-attachments').remove([message.attachment_url])
    }
    const { error } = await supabase.from('messages').delete().eq('id', message.id)
    if (error) {
      setSendError(error.message)
      return
    }
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
  }

  // Jitsi's public server needs no account, API key, or card — just a room
  // name. Deriving it from the conversation's UUID keeps it stable (everyone
  // in the conversation lands in the same room) and effectively collision-free
  // with anyone else's room on the shared public server.
  function joinVideoCall() {
    setIncomingCallFrom(null)
    setVideoUrl(`https://meet.jit.si/studycult-${conversation.id}`)
  }

  // Opens the room locally AND signals everyone else in the conversation —
  // previously this only did the former, so the other participant had no way
  // to know a call had started unless they happened to open the same room
  // themselves at the same time.
  function startVideoCall() {
    joinVideoCall()
    channelRef.current?.send({
      type: 'broadcast',
      event: 'video_call_started',
      payload: { callerName: myName || 'Someone' },
    })
    if (otherMemberIds.length > 0) {
      supabase.from('events').insert(
        otherMemberIds.map((userId) => ({
          user_id: userId,
          type: 'video_call_started',
          payload: { conversation_id: conversation.id, caller_name: myName || 'Someone' },
        }))
      )
    }
  }

  // 1:1 chats get the ringing flow (CallContext) — ring, accept/decline,
  // 30s miss timeout, appears anywhere in the app for the receiver. Groups
  // keep the older "everyone who has this chat open gets pinged, join the
  // shared room whenever" behavior above: a `calls` row has exactly one
  // receiver, so it isn't a fit for a multi-member conversation.
  function handleStartCall() {
    if (conversation.is_group || otherMemberIds.length !== 1) {
      startVideoCall()
      return
    }
    const receiverId = otherMemberIds[0]
    placeCall({ conversationId: conversation.id, receiverId, receiverName: nameById[receiverId] })
    supabase.from('events').insert({
      user_id: receiverId,
      type: 'video_call_started',
      payload: { conversation_id: conversation.id, caller_name: myName || 'Someone' },
    })
  }

  async function submitReport(e) {
    e.preventDefault()
    if (!reportReason.trim() || otherMemberIds.length !== 1) return
    setSafetyBusy(true)
    setSafetyError('')
    const { error } = await supabase.from('reports').insert({
      reporter_id: myId,
      reported_user_id: otherMemberIds[0],
      conversation_id: conversation.id,
      reason: reportReason.trim(),
    })
    setSafetyBusy(false)
    if (error) {
      setSafetyError(error.message)
      return
    }
    setReportOpen(false)
    setReportReason('')
    setMenuOpen(false)
  }

  async function toggleBlock() {
    if (otherMemberIds.length !== 1) return
    if (!blocked && !confirm('Block this person? They will no longer be able to message you.')) return
    setSafetyBusy(true)
    setSafetyError('')
    const { error } = blocked
      ? await supabase.from('blocked_users').delete().eq('blocker_id', myId).eq('blocked_id', otherMemberIds[0])
      : await supabase.from('blocked_users').insert({ blocker_id: myId, blocked_id: otherMemberIds[0] })
    setSafetyBusy(false)
    if (error) {
      setSafetyError(error.message)
      return
    }
    setBlocked((prev) => !prev)
    setMenuOpen(false)
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        Pick a conversation to start chatting.
      </div>
    )
  }

  const onlineOtherCount = otherMemberIds.filter((id) => onlineIds.has(id)).length

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-display text-lg font-medium text-ink">
              {conversation.is_group ? conversation.name : memberNames?.[conversation.id] || 'Conversation'}
            </p>
            {!conversation.is_group && onlineOtherCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-teal">
                <span className="h-2 w-2 rounded-full bg-teal" /> online
              </span>
            )}
          </div>
          {conversation.is_group && (
            <p className="text-xs text-muted">
              {conversation.subject}
              {conversation.subject && ' · '}
              <button onClick={() => setRosterOpen((o) => !o)} className="underline-offset-2 hover:text-ink hover:underline">
                {otherMembers.length + 1} member{otherMembers.length === 0 ? '' : 's'}
                {onlineOtherCount > 0 && ` · ${onlineOtherCount} online`}
              </button>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {conversation.is_group && (
            <div className="relative">
              <button onClick={() => setRosterOpen((o) => !o)} className="btn btn-outline px-3 py-1.5 text-xs">
                👥 Members
              </button>
              {rosterOpen && (
                <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-paper-raised py-2 shadow-[0_20px_50px_-20px_rgba(22,35,61,0.35)]">
                  <p className="px-4 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted">In this room</p>
                  <div className="flex items-center gap-2 px-4 py-1.5 text-sm text-ink">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-teal" />
                    {myName || 'You'} <span className="text-xs text-muted">(you)</span>
                  </div>
                  {otherMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-4 py-1.5 text-sm text-ink-soft">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${onlineIds.has(m.id) ? 'bg-teal' : 'bg-line'}`} />
                      {displayName(m, myRole)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={handleStartCall} className="btn btn-outline px-3 py-1.5 text-xs">
            🎥 Start video call
          </button>
          {!conversation.is_group && otherMemberIds.length === 1 && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-full border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:border-ink/30"
                aria-label="Safety options"
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-40 mt-2 w-44 rounded-xl border border-line bg-paper-raised py-1 shadow-[0_20px_50px_-20px_rgba(22,35,61,0.35)]">
                  <button
                    onClick={() => {
                      setReportOpen(true)
                      setMenuOpen(false)
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-ink-soft hover:bg-teal-soft"
                  >
                    Report
                  </button>
                  <button
                    onClick={toggleBlock}
                    className={`block w-full px-4 py-2 text-left text-sm ${
                      blocked ? 'text-teal hover:bg-teal-soft' : 'text-danger hover:bg-danger/10'
                    }`}
                  >
                    {blocked ? 'Unblock' : 'Block'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {safetyError && <p className="border-b border-line px-6 py-2 text-xs text-danger">{safetyError}</p>}
      {blocked && <p className="border-b border-line bg-teal-soft px-6 py-2 text-xs text-ink">Blocked.</p>}
      {incomingCallFrom && !videoUrl && (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-teal-soft px-6 py-2.5">
          <p className="text-sm text-ink">📹 {incomingCallFrom} started a video call.</p>
          <div className="flex shrink-0 items-center gap-3">
            <button onClick={joinVideoCall} className="btn btn-accent px-3 py-1.5 text-xs">
              Join
            </button>
            <button onClick={() => setIncomingCallFrom(null)} className="text-xs text-muted hover:text-ink">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6">
          <form onSubmit={submitReport} className="card w-full max-w-sm p-6">
            <h2 className="font-display text-xl font-medium text-ink">Report this person</h2>
            <textarea
              required
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="What happened?"
              className="input mt-4 min-h-24 w-full"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted"
              >
                Cancel
              </button>
              <button type="submit" disabled={safetyBusy} className="btn btn-primary px-5 py-2.5 text-sm">
                {safetyBusy ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {videoUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/95">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-medium text-paper">Video call</p>
            <button
              onClick={() => setVideoUrl(null)}
              className="rounded-full border border-paper/30 px-3 py-1 text-xs font-medium text-paper hover:border-paper"
            >
              Close
            </button>
          </div>
          <iframe
            src={videoUrl}
            title="Video call"
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="flex-1 border-0"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <p className="text-sm text-muted">Loading messages…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted">No messages yet — say hi.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => {
              const showDayDivider = i === 0 || formatDayLabel(m.created_at) !== formatDayLabel(messages[i - 1].created_at)
              return (
              <div key={m.id}>
                {showDayDivider && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-full bg-paper-raised px-3 py-1 text-[11px] font-medium text-muted">
                      {formatDayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${m.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[75%] flex-col ${m.sender_id === myId ? 'items-end' : 'items-start'}`}>
                  {conversation.is_group && m.sender_id !== myId && (
                    <span className="mb-0.5 px-1 text-[11px] font-medium text-muted">
                      {nameById[m.sender_id] || 'Someone'}
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-snug ${
                      m.sender_id === myId ? 'bg-ink text-paper' : 'bg-teal-soft text-ink'
                    }`}
                  >
                    {m.attachment_url && m.attachment_type === 'image' && signedUrls[m.attachment_url] && (
                      <img
                        src={signedUrls[m.attachment_url]}
                        alt={m.content}
                        className="mb-1.5 max-h-48 rounded-lg object-cover"
                      />
                    )}
                    {m.attachment_url && m.attachment_type === 'video' && signedUrls[m.attachment_url] && (
                      <video controls src={signedUrls[m.attachment_url]} className="mb-1.5 max-h-48 rounded-lg" />
                    )}
                    {m.attachment_url && m.attachment_type === 'audio' && signedUrls[m.attachment_url] && (
                      <audio controls src={signedUrls[m.attachment_url]} className="mb-1 h-10 max-w-[220px]" />
                    )}
                    {m.attachment_url && m.attachment_type === 'file' && (
                      <a
                        href={signedUrls[m.attachment_url] || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1 flex items-center gap-1.5 underline"
                      >
                        📎 {m.content}
                      </a>
                    )}
                    {!m.attachment_url && m.content}
                  </div>
                  <span className="mt-1 flex items-center gap-2 px-1 text-[10px] text-muted">
                    {formatTimeOnly(m.created_at)}
                    <button onClick={() => deleteForMe(m)} className="hover:text-danger hover:underline">
                      Delete for me
                    </button>
                    {m.sender_id === myId && (
                      <button onClick={() => deleteForEveryone(m)} className="hover:text-danger hover:underline">
                        Delete for everyone
                      </button>
                    )}
                  </span>
                </div>
                </div>
              </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {sendError && <p className="px-6 pt-2 text-xs text-danger">{sendError}</p>}

      {recording ? (
        <div className="flex items-center gap-3 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={cancelRecording}
            className="btn btn-danger-outline shrink-0 px-3 py-2.5 text-sm"
            aria-label="Discard recording"
            title="Discard"
          >
            🗑
          </button>
          <span className="flex flex-1 items-center gap-2 text-sm text-danger">
            <span className={`h-2 w-2 rounded-full bg-danger ${recordPaused ? '' : 'animate-pulse'}`} />
            {recordPaused ? 'Paused' : 'Recording…'} {recordSeconds}s
          </span>
          <button
            type="button"
            onClick={togglePauseRecording}
            className="btn btn-outline shrink-0 px-3 py-2.5 text-sm"
            aria-label={recordPaused ? 'Resume recording' : 'Pause recording'}
            title={recordPaused ? 'Resume' : 'Pause'}
          >
            {recordPaused ? '▶' : '⏸'}
          </button>
          <button type="button" onClick={stopRecording} className="btn btn-primary shrink-0 px-5 py-2.5 text-sm">
            Send
          </button>
        </div>
      ) : (
        <form onSubmit={sendMessage} className="flex items-center gap-3 border-t border-line px-6 py-4">
          <input type="file" ref={fileInputRef} onChange={sendAttachment} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={attaching}
            className="btn btn-outline shrink-0 px-3 py-2.5 text-sm"
            aria-label="Attach a file"
          >
            {attaching ? '…' : '📎'}
          </button>
          <button
            type="button"
            onClick={startRecording}
            disabled={attaching}
            className="btn btn-outline shrink-0 px-3 py-2.5 text-sm"
            aria-label="Record a voice message"
          >
            🎤
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            className="input flex-1"
          />
          <button type="submit" className="btn btn-primary px-5 py-2.5 text-sm" disabled={!draft.trim()}>
            Send
          </button>
        </form>
      )}
    </div>
  )
}
