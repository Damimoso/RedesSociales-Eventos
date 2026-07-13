import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Link, useSearchParams } from 'react-router-dom'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read_at: string | null
  created_at: string
}

type Conversation = {
  other: Profile
  lastMessage: Message | null
  unread: number
}

export default function Messages() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(searchParams.get('user'))
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const fetchConversations = useCallback(async () => {
    if (!user) return
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    if (!msgs) { setLoading(false); return }

    const otherIds = new Set<string>()
    const lastByUser = new Map<string, Message>()
    const unreadCount = new Map<string, number>()

    msgs.forEach(m => {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
      otherIds.add(otherId)
      if (!lastByUser.has(otherId)) lastByUser.set(otherId, m)
      if (m.receiver_id === user.id && !m.read_at) {
        unreadCount.set(otherId, (unreadCount.get(otherId) ?? 0) + 1)
      }
    })

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', [...otherIds])
    const profileMap = new Map<string, Profile>((profiles ?? []).map(p => [p.id, p]))

    const convs: Conversation[] = [...otherIds].map(id => ({
      other: profileMap.get(id) ?? { id, display_name: 'Usuario', avatar_url: null },
      lastMessage: lastByUser.get(id) ?? null,
      unread: unreadCount.get(id) ?? 0,
    }))
    convs.sort((a, b) => {
      if (!a.lastMessage) return 1
      if (!b.lastMessage) return -1
      return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    })
    setConversations(convs)
    setLoading(false)
  }, [user])

  const fetchMessages = useCallback(async (otherId: string) => {
    if (!user) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setTimeout(scrollToBottom, 50)

    await supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('receiver_id', user.id).eq('sender_id', otherId).is('read_at', null)
    fetchConversations()
  }, [user, fetchConversations])

  useEffect(() => {
    if (!user || !selectedUserId) return
    fetchMessages(selectedUserId)

    const channel = supabase.channel(`messages:${user.id}-${selectedUserId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${selectedUserId},receiver_id=eq.${user.id}`,
      }, () => { fetchMessages(selectedUserId) })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${user.id},receiver_id=eq.${selectedUserId}`,
      }, () => { fetchMessages(selectedUserId) })
      .subscribe()

    unsubRef.current = () => { supabase.removeChannel(channel) }
    return () => { unsubRef.current?.(); unsubRef.current = null }
  }, [user, selectedUserId])

  useEffect(() => {
    if (!user) return
    fetchConversations()

    const channel = supabase.channel('messages:global')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, () => { fetchConversations() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, fetchConversations])

  useEffect(() => {
    const uid = searchParams.get('user')
    if (uid && uid !== selectedUserId) {
      setSelectedUserId(uid)
    }
  }, [searchParams])

  const sendMessage = async () => {
    if (!user || !selectedUserId || !text.trim()) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedUserId,
      content: text.trim(),
    })
    if (!error) {
      setText('')
      fetchMessages(selectedUserId)
      fetchConversations()
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (loading) return <LoadingSpinner />
  if (!user) return <p className="text-center text-muted py-16">Inicia sesión para ver tus mensajes</p>

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-text mb-4">Mensajes</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="bg-surface rounded-xl border border-primary/10 overflow-y-auto md:col-span-1">
          {conversations.length === 0 && (
            <p className="text-center text-muted p-6 text-sm">No hay conversaciones</p>
          )}
          {conversations.map(c => (
            <button key={c.other.id} onClick={() => { setSelectedUserId(c.other.id); setSearchParams({ user: c.other.id }) }}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-elevated transition-colors border-b border-primary/5 ${selectedUserId === c.other.id ? 'bg-elevated' : ''}`}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-secondary))', color: '#fff' }}>
                {c.other.display_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm truncate">{c.other.display_name ?? 'Usuario'}</p>
                  {c.unread > 0 && (
                    <span className="bg-primary text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted truncate">{c.lastMessage?.content ?? 'Sin mensajes'}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="md:col-span-2 bg-surface rounded-xl border border-primary/10 flex flex-col">
          {selectedUserId ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {conversations.filter(c => c.other.id === selectedUserId).map(c => (
                  <div key={c.other.id} className="text-center mb-2">
                    <Link to="/profile" className="w-10 h-10 rounded-full inline-flex items-center justify-center text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-secondary))', color: '#fff' }}>
                      {c.other.display_name?.[0]?.toUpperCase() ?? '?'}
                    </Link>
                    <p className="text-sm font-medium mt-1">{c.other.display_name ?? 'Usuario'}</p>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-center text-muted text-sm py-8">No hay mensajes aún. ¡Envía el primero!</p>
                )}
                {messages.map(m => {
                  const isMine = m.sender_id === user.id
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-primary text-white rounded-br-md' : 'bg-elevated text-text rounded-bl-md'}`}>
                        <p>{m.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-white/70' : 'text-muted'}`}>
                          {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              <div className="border-t border-primary/10 p-3 flex gap-2">
                <textarea
                  value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  className="flex-1 bg-elevated border border-primary/20 rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button onClick={sendMessage} loading={sending} disabled={!text.trim()}>Enviar</Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted text-sm">
              Selecciona una conversación
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
