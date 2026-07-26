'use client'

import { motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/lib/motionTokens'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { extractForthLinks, normalizeForthUrl } from '@/lib/forth'

type Reaction = { emoji: string; count: number; mine: boolean }

type ChatMessage = {
  id: number
  body: string
  attachmentUrl?: string | null
  createdAt: string
  authorId: string
  authorName: string | null
  authorHandle: string | null
  authorAvatar: string | null
  reactions: Reaction[]
  replyCount?: number
  parentId?: number | null
  editedAt?: string | null
}

/** Reaction palette, mirrored by the allow-list in /api/reactions. */
const EMOJI = ['👍', '🎉', '🔥', '👀', '✅', '❤️']

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDay(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  return isToday
    ? 'Today'
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** Render message text with bare URLs linked and @handles rendered as chips.
 * A mention of the viewer is tinted so it is findable while scrolling.
 * Forth view paths are rewritten to the live SPA root (Forth has no /board route).
 */
function MessageBody({ body, meHandle }: { body: string; meHandle?: string }) {
  const parts = body.split(/(https?:\/\/[^\s<>()]+|@[a-zA-Z0-9_-]{2,39})/g)
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span
            key={i}
            className={`rounded px-1 font-medium ${
              meHandle && part.slice(1).toLowerCase() === meHandle.toLowerCase()
                ? 'bg-accent text-on-accent'
                : 'text-accent'
            }`}
          >
            {part}
          </span>
        ) : /^https?:\/\//.test(part) ? (
          (() => {
            const forth = normalizeForthUrl(part.replace(/[.,;:]+$/, ''))
            const href = forth?.url ?? part
            return (
              <a
                key={i}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline decoration-accent/40"
              >
                {part}
              </a>
            )
          })()
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  )
}

/**
 * A pasted Forth URL renders as a card, so a thread about a ticket carries a
 * one-click route back to the board.
 */
function ForthCards({ body }: { body: string }) {
  const links = extractForthLinks(body)
  if (links.length === 0) return null

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-pm-line bg-pm-soft px-3 py-2 text-xs text-pm hover:brightness-110"
        >
          <span aria-hidden>⚒</span>
          <span className="font-semibold">{link.label}</span>
          <span className="truncate">{link.url}</span>
          <span className="ml-auto shrink-0">Open ↗</span>
        </a>
      ))}
    </div>
  )
}


/**
 * One message row. Memoised because the conversation re-polls every 2s: without
 * this every row re-renders on each tick even when nothing about it changed
 * (rerender-memo). Reference-stable callbacks keep the memo effective.
 */
const MessageRow = memo(function MessageRow({
  message,
  day,
  showDay,
  onReact,
  onOpenThread,
  meHandle,
}: {
  message: ChatMessage
  day: string
  showDay: boolean
  meHandle?: string
  onReact: (messageId: number, emoji: string) => void
  onOpenThread?: (rootId: number) => void
}) {
  return (
    <li>
      {showDay && (
        <div className="flex items-center gap-3 py-2">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-medium text-muted">{day}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <div className="flex gap-3">
        {message.authorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.authorAvatar}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            className="mt-0.5 h-8 w-8 shrink-0 rounded-full"
          />
        ) : (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-xs">
            {(message.authorName ?? '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {message.authorName ?? 'Unknown'}
            </span>
            <span className="tabular text-[11px] text-muted">
              {formatTime(message.createdAt)}
            </span>
          </div>
          <MessageBody body={message.body} meHandle={meHandle} />
          <ForthCards body={message.body} />
          {message.attachmentUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.attachmentUrl}
              alt="Attachment"
              className="mt-2 max-h-64 max-w-full rounded-lg border border-line"
            />
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1">
            {message.reactions?.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => onReact(message.id, reaction.emoji)}
                aria-label={`${reaction.mine ? 'Remove' : 'Add'} ${reaction.emoji} reaction`}
                aria-pressed={reaction.mine}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  reaction.mine
                    ? 'border-accent bg-accent-soft'
                    : 'border-line hover:bg-raised'
                }`}
              >
                <span className="tabular">
                  {reaction.emoji} {reaction.count}
                </span>
              </button>
            ))}
            {onOpenThread && !message.parentId && (
              <button
                onClick={() => onOpenThread(message.id)}
                className="rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:bg-raised hover:text-body"
              >
                {message.replyCount
                  ? `${message.replyCount} ${
                      message.replyCount === 1 ? 'reply' : 'replies'
                    }`
                  : 'Reply'}
              </button>
            )}
            <div className="group relative">
              <button
                aria-label="Add reaction"
                className="rounded-full border border-line px-2 py-0.5 text-xs text-muted opacity-0 transition hover:bg-raised focus:opacity-100 group-hover:opacity-100"
              >
                +
              </button>
              <div className="absolute bottom-full left-0 z-10 mb-1 hidden gap-0.5 rounded-lg border border-line bg-panel p-1 shadow-lg group-focus-within:flex group-hover:flex">
                {EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(message.id, emoji)}
                    aria-label={`React with ${emoji}`}
                    className="rounded px-1.5 py-0.5 text-sm hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
})

export default function ChatView({
  scope,
  title,
  subtitle,
  readOnly = false,
  readOnlyReason,
  onOpenThread,
  compact = false,
}: {
  scope: string
  title: string
  subtitle?: string
  readOnly?: boolean
  readOnlyReason?: string
  /** Opens the given root message in the thread panel. */
  onOpenThread?: (rootId: number) => void
  compact?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [live, setLive] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const key = `/api/messages?scope=${encodeURIComponent(scope)}`
  const reduceMotion = useReducedMotion()
  const { data, mutate } = useSWR<{ messages: ChatMessage[] }>(key, fetcher, {
    // SSE drives freshness; poll only while the stream is down.
    refreshInterval: live ? 0 : 2000,
  })

  // SWR dedupes this with the sidebar's identical request.
  const { data: boot } = useSWR<{
    me?: { handle?: string }
    members?: { handle: string; name: string }[]
  }>('/api/bootstrap', fetcher)
  const meHandle = boot?.me?.handle
  const roster = boot?.members ?? []

  const messages = data?.messages ?? []

  // Follow the conversation as it grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Near-realtime via SSE; reconnect when the server closes the stream.
  useEffect(() => {
    let es: EventSource | null = null
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (cancelled) return
      es = new EventSource(`/api/events?scope=${encodeURIComponent(scope)}`)
      es.onopen = () => setLive(true)
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload.type === 'message') mutate()
        } catch {
          /* ignore malformed frames */
        }
      }
      es.onerror = () => {
        setLive(false)
        es?.close()
        timer = setTimeout(connect, 1200)
      }
    }
    connect()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      es?.close()
      setLive(false)
    }
  }, [scope, mutate])

  const react = useCallback(async (messageId: number, emoji: string) => {
    await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, emoji }),
    })
    mutate()
  }, [mutate])

  function onDraftChange(value: string) {
    setDraft(value)
    const cursor = inputRef.current?.selectionStart ?? value.length
    const before = value.slice(0, cursor)
    const match = before.match(/@([a-zA-Z0-9_-]{0,39})$/)
    setMentionQuery(match ? match[1].toLowerCase() : null)
  }

  function insertMention(handle: string) {
    const cursor = inputRef.current?.selectionStart ?? draft.length
    const before = draft.slice(0, cursor)
    const after = draft.slice(cursor)
    const replaced = before.replace(/@([a-zA-Z0-9_-]{0,39})$/, `@${handle} `)
    setDraft(replaced + after)
    setMentionQuery(null)
    queueMicrotask(() => inputRef.current?.focus())
  }

  const mentionHits =
    mentionQuery === null
      ? []
      : roster
          .filter(
            (m) =>
              m.handle.toLowerCase().includes(mentionQuery) ||
              m.name.toLowerCase().includes(mentionQuery)
          )
          .slice(0, 6)

  async function onPickFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    setUploading(false)
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setError(payload.error ?? 'upload failed')
      return
    }
    const payload = await res.json()
    setAttachmentUrl(payload.url)
  }

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if ((!body && !attachmentUrl) || sending || uploading) return

    setSending(true)
    setError(null)
    const pendingAttachment = attachmentUrl
    setDraft('')
    setAttachmentUrl(null)
    setMentionQuery(null)

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, body, attachmentUrl: pendingAttachment }),
    })
    setSending(false)

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setError(payload.error ?? 'could not send')
      setDraft(body)
      setAttachmentUrl(pendingAttachment)
      return
    }
    mutate()
  }

  let lastDay = ''

  return (
    <>
      <header className="border-b border-line px-5 py-3">
        <h1 className="font-semibold">{title}</h1>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!data && <p className="text-sm text-muted">Loading messages…</p>}
        {data && messages.length === 0 && (
          <p className="text-sm text-muted">
            No messages yet. Say something to get it started.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {messages.map((message) => {
            const day = formatDay(message.createdAt)
            const showDay = day !== lastDay
            lastDay = day
            return (
              <MessageRow
                key={message.id}
                message={message}
                day={day}
                showDay={showDay}
                onReact={react}
                onOpenThread={onOpenThread}
                meHandle={meHandle}
              />
            )
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      {readOnly ? (
        <div className="border-t border-line px-5 py-4 text-center text-sm text-muted">
          🔒 {readOnlyReason ?? 'This channel is read-only.'}
        </div>
      ) : (
        <form onSubmit={send} className="relative border-t border-line px-5 py-3">
          {error && <p className="pb-2 text-xs text-red-500">{error}</p>}
          {mentionHits.length > 0 && (
            <div
              role="listbox"
              aria-label="Mention suggestions"
              className="absolute bottom-full left-5 right-5 z-20 mb-1 overflow-hidden rounded-lg border border-line bg-panel shadow-lg"
            >
              {mentionHits.map((member) => (
                <button
                  key={member.handle}
                  type="button"
                  role="option"
                  onClick={() => insertMention(member.handle)}
                  className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-raised"
                >
                  <span className="font-semibold text-accent">
                    @{member.handle}
                  </span>
                  <span className="truncate text-muted">{member.name}</span>
                </button>
              ))}
            </div>
          )}
          {attachmentUrl && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-raised px-2 py-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachmentUrl} alt="" className="h-10 w-10 rounded object-cover" />
              <span className="text-xs text-muted">Image attached</span>
              <button
                type="button"
                onClick={() => setAttachmentUrl(null)}
                className="ml-auto text-xs text-muted hover:text-body"
              >
                Remove
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-raised hover:text-body disabled:opacity-40"
              aria-label="Attach image"
            >
              {uploading ? '…' : '+'}
            </button>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder={`Message ${title}…`}
              aria-label={`Message ${title}`}
              autoComplete="off"
              className="flex-1 rounded-lg border border-line bg-raised px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              type="submit"
              disabled={sending || uploading || (!draft.trim() && !attachmentUrl)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-40"
            >
              Send
            </button>
          </div>
          <p className="flex items-center gap-1.5 pt-1.5 text-[11px] text-muted">
            <motion.span
              key={live ? 'live' : 'connecting'}
              initial={{ opacity: reduceMotion ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: reduceMotion ? 0.1 : motionTokens.duration.fast,
                ease: motionTokens.easing.sharp,
              }}
              className={live ? 'font-semibold text-emerald-500' : ''}
            >
              {live ? 'Live' : 'Connecting…'}
            </motion.span>
            <span>· @mention · Reply · Attach image · Forth links</span>
          </p>
        </form>
      )}
    </>
  )
}
