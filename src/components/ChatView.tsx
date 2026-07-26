'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { extractForthLinks } from '@/lib/forth'

type ChatMessage = {
  id: number
  body: string
  createdAt: string
  authorId: string
  authorName: string | null
  authorHandle: string | null
  authorAvatar: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Render message text with bare URLs turned into links. */
function MessageBody({ body }: { body: string }) {
  const parts = body.split(/(https?:\/\/[^\s<>()]+)/g)
  return (
    <p className="whitespace-pre-wrap break-words text-sm text-slate-200">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-300 underline decoration-indigo-500/40 hover:text-indigo-200"
          >
            {part}
          </a>
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
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/20"
        >
          <span aria-hidden>⚒</span>
          <span className="font-semibold">{link.label}</span>
          <span className="truncate text-amber-200/60">{link.url}</span>
          <span className="ml-auto shrink-0 text-amber-200/60">Open ↗</span>
        </a>
      ))}
    </div>
  )
}

export default function ChatView({
  scope,
  title,
  subtitle,
}: {
  scope: string
  title: string
  subtitle?: string
}) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const key = `/api/messages?scope=${encodeURIComponent(scope)}`
  const { data, mutate } = useSWR<{ messages: ChatMessage[] }>(key, fetcher, {
    refreshInterval: 2000,
  })

  const messages = data?.messages ?? []

  // Follow the conversation as it grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return

    setSending(true)
    setError(null)
    setDraft('')

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, body }),
    })
    setSending(false)

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setError(payload.error ?? 'could not send')
      setDraft(body)
      return
    }
    mutate()
  }

  return (
    <>
      <header className="border-b border-slate-800 px-5 py-3">
        <h1 className="font-semibold">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!data && <p className="text-sm text-slate-500">Loading messages…</p>}
        {data && messages.length === 0 && (
          <p className="text-sm text-slate-500">
            No messages yet. Say something to get it started.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {messages.map((message) => (
            <li key={message.id} className="flex gap-3">
              {message.authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={message.authorAvatar}
                  alt=""
                  className="mt-0.5 h-8 w-8 shrink-0 rounded-full"
                />
              ) : (
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs">
                  {(message.authorName ?? '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">
                    {message.authorName ?? 'Unknown'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatTime(message.createdAt)}
                  </span>
                </div>
                <MessageBody body={message.body} />
                <ForthCards body={message.body} />
              </div>
            </li>
          ))}
        </ul>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="border-t border-slate-800 px-5 py-3">
        {error && <p className="pb-2 text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${title}`}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="pt-1.5 text-[11px] text-slate-500">
          Paste a Forth link to attach the board item to this conversation.
        </p>
      </form>
    </>
  )
}
