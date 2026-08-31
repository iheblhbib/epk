import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/api/notifications'
import { useAuth } from '@/providers/AuthProvider'

export const notificationsKey = ['notifications'] as const
export const unreadNotificationCountKey = ['notifications', 'unread-count'] as const

// Polling rather than a websocket/broadcast channel — simple, and the
// 30s cadence is plenty responsive for "you were invited to a workspace"
// without adding an infrastructure dependency (Pusher/Reverb) this app
// doesn't otherwise need. Both queries are gated on being signed in so a
// logged-out visitor on a public/private EPK page never polls at all.
const POLL_INTERVAL_MS = 30_000

export function useUnreadNotificationCount() {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: unreadNotificationCountKey,
    queryFn: getUnreadNotificationCount,
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
  })
}

export function useNotifications(enabled: boolean) {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: notificationsKey,
    queryFn: () => listNotifications(),
    enabled: isAuthenticated && enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
  })
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKey })
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountKey })
    },
  })
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKey })
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountKey })
    },
  })
}
