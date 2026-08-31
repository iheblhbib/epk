import { apiClient } from '@/api/client'
import type { AppNotification, ApiPaginated, ApiResource } from '@/types'

export async function listNotifications(page = 1): Promise<ApiPaginated<AppNotification>> {
  const { data } = await apiClient.get<ApiPaginated<AppNotification>>('/api/notifications', {
    params: { page },
  })
  return data
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>('/api/notifications/unread-count')
  return data.count
}

export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  const { data } = await apiClient.post<ApiResource<AppNotification>>(`/api/notifications/${id}/read`)
  return data.data
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await apiClient.post('/api/notifications/mark-all-read')
}
