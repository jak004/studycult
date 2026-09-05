import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatWindow from './ChatWindow'
import { supabase } from '../lib/supabaseClient'

// A generic chainable + thenable query builder: every filter method
// (.select/.eq/.neq/...) returns the same object, and awaiting it at any
// point resolves via its own .then() — good enough to stand in for
// supabase-js's real query builder across the handful of chains ChatWindow
// actually uses. Every .insert() call is recorded on globalThis.__insertedRows
// so tests can assert on it regardless of which table's builder made it.
vi.mock('../lib/supabaseClient', () => {
  function makeQueryBuilder(table) {
    const builder = {}
    let singleMode = false
    ;['select', 'eq', 'neq', 'order', 'in', 'limit'].forEach((method) => {
      builder[method] = vi.fn(() => builder)
    })
    // .maybeSingle()/.single() resolve to one row-or-null, not the list — flip
    // a flag rather than a separate resolution path, since every other method
    // in this chain still just returns `builder` itself.
    ;['maybeSingle', 'single'].forEach((method) => {
      builder[method] = vi.fn(() => {
        singleMode = true
        return builder
      })
    })
    builder.insert = vi.fn((payload) => {
      globalThis.__insertedRows.push({ table, payload })
      return Promise.resolve({ data: null, error: null })
    })
    builder.update = vi.fn(() => builder)
    // Only conversation_members needs non-empty data — ChatWindow uses it to
    // find "the other participant(s)" for notifications; every other table
    // stays empty, which is fine for the tests below.
    const rows = table === 'conversation_members' ? [{ user_id: 'user-2' }] : []
    builder.then = (resolve) => Promise.resolve({ data: singleMode ? null : rows, error: null }).then(resolve)
    return builder
  }

  const channel = {
    on: vi.fn(function () {
      return channel
    }),
    subscribe: vi.fn(function (cb) {
      // Real Supabase Realtime calls back asynchronously, after the actual
      // handshake — ChatWindow.jsx relies on that to safely reference its
      // own `channel` binding from inside this callback.
      Promise.resolve().then(() => cb?.('SUBSCRIBED'))
      return channel
    }),
    track: vi.fn(() => Promise.resolve()),
    presenceState: vi.fn(() => ({})),
    send: vi.fn(() => Promise.resolve('ok')),
  }

  return {
    supabase: {
      from: vi.fn((table) => makeQueryBuilder(table)),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn() })) },
    },
  }
})

const conversation = { id: 'convo-1', is_group: false, name: null, subject: null }

beforeEach(() => {
  globalThis.__insertedRows = []
})

describe('ChatWindow — sending a message', () => {
  it('inserts the message with the right conversation, sender, and content', async () => {
    const user = userEvent.setup()
    render(<ChatWindow conversation={conversation} myId="user-1" myName="Test User" memberNames={{}} />)

    const input = await screen.findByPlaceholderText('Type a message…')
    await user.type(input, 'Hello there')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => {
      const messageInsert = globalThis.__insertedRows.find((row) => row.table === 'messages')
      expect(messageInsert?.payload).toMatchObject({
        conversation_id: 'convo-1',
        sender_id: 'user-1',
        content: 'Hello there',
      })
    })
  })

  it('clears the input after a successful send', async () => {
    const user = userEvent.setup()
    render(<ChatWindow conversation={conversation} myId="user-1" myName="Test User" memberNames={{}} />)

    const input = await screen.findByPlaceholderText('Type a message…')
    await user.type(input, 'Hello there')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('does not send an empty message', async () => {
    render(<ChatWindow conversation={conversation} myId="user-1" myName="Test User" memberNames={{}} />)

    expect(await screen.findByRole('button', { name: 'Send' })).toBeDisabled()
    expect(globalThis.__insertedRows).toHaveLength(0)
  })
})

describe('ChatWindow — starting a video call', () => {
  it('broadcasts to the channel and queues a notification for the other participant', async () => {
    const user = userEvent.setup()
    render(<ChatWindow conversation={conversation} myId="user-1" myName="Test User" memberNames={{}} />)

    await user.click(await screen.findByRole('button', { name: /start video call/i }))

    const channel = supabase.channel()
    await waitFor(() => {
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'video_call_started', payload: { callerName: 'Test User' } })
      )
    })

    await waitFor(() => {
      const eventInsert = globalThis.__insertedRows.find((row) => row.table === 'events')
      expect(eventInsert?.payload).toMatchObject([
        { user_id: 'user-2', type: 'video_call_started', payload: { conversation_id: 'convo-1' } },
      ])
    })
  })
})
