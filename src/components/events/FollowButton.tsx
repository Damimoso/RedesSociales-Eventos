import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

type Props = {
  followingId: string
  followingType: 'artist' | 'organizer'
  size?: 'sm' | 'md' | 'lg'
}

export function FollowButton({ followingId, followingType, size = 'sm' }: Props) {
  const { user } = useAuth()
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase.from('follows').select('id')
      .eq('follower_id', user.id)
      .eq('following_id', followingId)
      .eq('following_type', followingType)
      .maybeSingle()
      .then(({ data }) => {
        setFollowing(!!data)
        setLoading(false)
      })
  }, [user, followingId, followingType])

  const handleToggle = async () => {
    if (!user) return
    setToggling(true)
    if (following) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id)
        .eq('following_id', followingId)
        .eq('following_type', followingType)
      setFollowing(false)
    } else {
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: followingId,
        following_type: followingType,
      })
      setFollowing(true)
    }
    setToggling(false)
  }

  if (!user || loading) return null

  return (
    <Button onClick={handleToggle} loading={toggling} size={size}
      variant={following ? 'secondary' : 'primary'}>
      {following ? 'Dejar de seguir' : 'Seguir'}
    </Button>
  )
}
