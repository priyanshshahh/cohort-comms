'use client'

import { useEffect, useState } from 'react'
import ChatView from './ChatView'

/**
 * A conversation plus its thread panel. Opening a thread slides a second
 * column in beside the main transcript so replies never bury the channel,
 * which is the point of threading in an async cohort.
 */
export default function Conversation({
  scope,
  title,
  subtitle,
  readOnly = false,
  readOnlyReason,
}: {
  scope: string
  title: string
  subtitle?: string
  readOnly?: boolean
  readOnlyReason?: string
}) {
  const [threadRoot, setThreadRoot] = useState<number | null>(null)

  // Only one right-hand panel may be open at a time; otherwise the message
  // column gets squeezed to unreadable width.
  useEffect(() => {
    function onPanel(event: Event) {
      const which = (event as CustomEvent<string>).detail
      if (which === 'forth') setThreadRoot(null)
    }
    window.addEventListener('comms:panel', onPanel)
    return () => window.removeEventListener('comms:panel', onPanel)
  }, [])

  function openThread(rootId: number) {
    window.dispatchEvent(new CustomEvent('comms:panel', { detail: 'thread' }))
    setThreadRoot(rootId)
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatView
          scope={scope}
          title={title}
          subtitle={subtitle}
          readOnly={readOnly}
          readOnlyReason={readOnlyReason}
          onOpenThread={openThread}
        />
      </div>

      {threadRoot !== null && (
        <aside className="fixed inset-0 z-40 flex flex-col overscroll-contain border-l border-line bg-app lg:static lg:z-0 lg:w-[380px] lg:shrink-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold">Thread</span>
            <button
              onClick={() => setThreadRoot(null)}
              className="ml-auto rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-raised hover:text-body"
            >
              Close
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <ChatView
              key={threadRoot}
              scope={`thread:${threadRoot}`}
              title="Thread"
              subtitle="Replies stay out of the main channel"
              readOnly={readOnly}
              readOnlyReason={readOnlyReason}
              compact
            />
          </div>
        </aside>
      )}
    </div>
  )
}
