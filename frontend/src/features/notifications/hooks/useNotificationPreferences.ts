import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNotificationPreferences, updateNotificationPreferences } from '@/api/notificationPreferences'

export const notificationPreferencesKey = ['notification-preferences'] as const

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationPreferencesKey,
    queryFn: getNotificationPreferences,
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (preferences) => {
      queryClient.setQueryData(notificationPreferencesKey, preferences)
    },
  })
}
