import { apiClient } from '@/api/client'
import type { ApiResource, NotificationPreferences } from '@/types'

// Deep-partial: callers only ever flip one toggle at a time, and the
// backend merges it into whatever's already stored.
export type NotificationPreferencesUpdate = Partial<{
  [K in keyof NotificationPreferences]: Partial<NotificationPreferences[K]>
}>

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await apiClient.get<ApiResource<NotificationPreferences>>('/api/user/notification-preferences')
  return data.data
}

export async function updateNotificationPreferences(payload: NotificationPreferencesUpdate): Promise<NotificationPreferences> {
  const { data } = await apiClient.put<ApiResource<NotificationPreferences>>('/api/user/notification-preferences', payload)
  return data.data
}
