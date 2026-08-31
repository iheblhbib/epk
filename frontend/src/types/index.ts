export type UserRole = 'user' | 'admin'
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type WorkspaceMemberStatus = 'pending' | 'active'
export type SubscriptionPlan = 'free' | 'pro' | 'business'
// Mirrors backend/app/Enums/Locale.php exactly.
export type UserLocale = 'en' | 'fr' | 'ar' | 'es' | 'pt' | 'de' | 'zh'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  locale: UserLocale
  avatar_url: string | null
  email_verified_at: string | null
  suspended_at: string | null
  two_factor_enabled: boolean
  created_at: string
}

// POST /api/login returns this instead of a User when the account has a
// confirmed two-factor secret — no session exists yet at that point, only
// after POST /api/two-factor-challenge succeeds (see LoginForm.tsx).
export interface TwoFactorRequired {
  two_factor_required: true
}

export type LoginResult = User | TwoFactorRequired

export function isTwoFactorRequired(result: LoginResult): result is TwoFactorRequired {
  return 'two_factor_required' in result
}

// Returned once, right after POST /api/user/two-factor-authentication — the
// backend never re-exposes an already-generated secret.
export interface TwoFactorSetup {
  secret: string
  otpauth_url: string
}

export interface Workspace {
  id: number
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  my_role: WorkspaceRole | null
  members_count: number | null
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: number
  role: WorkspaceRole
  status: WorkspaceMemberStatus
  email: string
  user: User | null
  invited_by: User | null
  joined_at: string | null
  created_at: string
}

// 'payload' rather than 'data' to avoid clashing with JsonResource's own
// top-level 'data' wrap key — see NotificationResource on the backend.
export interface WorkspaceInvitationNotificationPayload {
  kind: 'workspace_invitation'
  member_id: number
  workspace_id: number
  workspace_name: string
  role: WorkspaceRole
  inviter_name: string | null
  invite_token: string
}

export interface EpkPublishedNotificationPayload {
  kind: 'epk_published'
  epk_id: number
  epk_title: string
  workspace_id: number
  publisher_name: string | null
  public_url: string
}

export interface TeamMemberJoinedNotificationPayload {
  kind: 'team_member_joined'
  workspace_id: number
  workspace_name: string
  member_name: string | null
  member_role: WorkspaceRole
}

// `kind` is a discriminant — a new backend notification type becomes a new
// tagged member of this union (plus its own *NotificationPayload interface
// above), and every switch on `kind` in the frontend gets a compile error
// pointing at every place that needs a case added for it.
export type AppNotification =
  | { id: string; kind: 'workspace_invitation'; payload: WorkspaceInvitationNotificationPayload; read_at: string | null; created_at: string }
  | { id: string; kind: 'epk_published'; payload: EpkPublishedNotificationPayload; read_at: string | null; created_at: string }
  | { id: string; kind: 'team_member_joined'; payload: TeamMemberJoinedNotificationPayload; read_at: string | null; created_at: string }

// Mirrors backend/config/notification_preferences.php — only the channels
// listed there are toggleable per kind, so this shape (not a generic
// Record<string, Record<string, boolean>>) is what keeps a typo like
// `epk_published.mail` (a channel that kind never sends on) a compile error
// instead of a silently-ignored PUT.
export interface ApiToken {
  id: number
  name: string
  last_used_at: string | null
  created_at: string
}

// Only ApiTokenController::store() ever returns this — Sanctum stores just
// a hash, so plain_text_token exists nowhere else and can't be fetched
// again later.
export interface CreatedApiToken extends ApiToken {
  plain_text_token: string
}

export interface NotificationPreferences {
  workspace_invitation: { mail: boolean; database: boolean }
  epk_published: { database: boolean }
  team_member_joined: { database: boolean }
}

export type EpkStatus = 'draft' | 'published' | 'archived'

export interface Artist {
  id: number
  workspace_id: number
  name: string
  stage_name: string | null
  short_bio: string | null
  country: string | null
  city: string | null
  genre: string | null
  website: string | null
  booking_email: string | null
  press_email: string | null
  management_email: string | null
  profile_image_url: string | null
  cover_image_url: string | null
  created_at: string
  updated_at: string
}

export interface Epk {
  id: number
  uuid: string
  workspace_id: number
  artist: Artist | null
  title: string
  slug: string
  status: EpkStatus
  cover_image_url: string | null
  theme: string
  custom_settings: Record<string, unknown> | null
  seo_title: string | null
  seo_description: string | null
  custom_domain: string | null
  custom_domain_verified: boolean
  public_url: string
  // Absolute URL to the backend's server-rendered Open Graph/Twitter Card
  // "unfurl" page (see backend/app/Http/Controllers/PublicEpkShareController.php)
  // — this is the link to paste into Slack/Twitter/etc, not `public_url`,
  // since a social crawler never runs the SPA's own client-side JS. Null
  // until the EPK is published (the share page 404s the same as the public
  // API does before then).
  share_url: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type MediaType = 'image' | 'audio' | 'video' | 'document'

export interface Media {
  id: number
  workspace_id: number
  filename: string
  original_filename: string
  url: string
  thumbnail_url: string | null
  mime_type: string
  type: MediaType
  size: number
  metadata: Record<string, unknown> | null
  uploaded_by: User | null
  created_at: string
  updated_at: string
}

export type SectionType =
  | 'hero'
  | 'biography'
  | 'photos'
  | 'music'
  | 'releases'
  | 'videos'
  | 'press'
  | 'events'
  | 'social_networks'
  | 'contact'
  | 'downloads'
  | 'credits'
  | 'custom'

export interface EpkSection {
  id: number
  epk_id: number
  type: SectionType
  label: string
  title: string | null
  is_enabled: boolean
  position: number
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface EpkSectionComment {
  id: number
  epk_section_id: number
  body: string
  // Null once the author's account has been deleted — the comment survives,
  // just anonymized (see backend/app/Http/Resources/EpkSectionCommentResource.php).
  user: User | null
  created_at: string
  updated_at: string
}

export interface HeroConfig {
  alignment?: 'left' | 'center' | 'right'
  height?: 'small' | 'medium' | 'large'
  overlay?: boolean
  headline?: string
  subtitle?: string
  description?: string
  profile_media_id?: number | null
  background_media_id?: number | null
  cta_label?: string
  cta_url?: string
}

export interface BiographyConfig {
  html?: string
}

export interface SocialLink {
  platform: string
  url: string
}

export interface SocialNetworksConfig {
  links?: SocialLink[]
}

export interface ContactConfig {
  booking_email?: string
  press_email?: string
  management_email?: string
  phone?: string
  website?: string
  address?: string
  show_phone?: boolean
  show_address?: boolean
}

export interface DownloadsConfig {
  media_ids?: number[]
}

export interface CreditItem {
  role: string
  name: string
}

export interface CreditsConfig {
  items?: CreditItem[]
}

export interface CustomConfig {
  heading?: string
  html?: string
}

export interface PhotoItem {
  media_id: number | null
  caption?: string
  credit?: string
}

export interface PhotosConfig {
  items?: PhotoItem[]
}

export type MusicProvider = 'upload' | 'spotify' | 'soundcloud'

export interface TrackItem {
  title?: string
  provider?: MusicProvider
  audio_media_id?: number | null
  url?: string
}

export interface MusicConfig {
  tracks?: TrackItem[]
}

export type ReleaseType = 'album' | 'ep' | 'single'

export interface ReleaseLinks {
  spotify?: string
  apple_music?: string
  youtube?: string
  soundcloud?: string
  deezer?: string
  bandcamp?: string
}

export interface ReleaseItem {
  title?: string
  type?: ReleaseType
  release_date?: string | null
  cover_media_id?: number | null
  links?: ReleaseLinks
}

export interface ReleasesConfig {
  releases?: ReleaseItem[]
}

export type VideoProvider = 'youtube' | 'vimeo' | 'upload'

export interface VideoItem {
  title?: string
  provider?: VideoProvider
  url?: string
  media_id?: number | null
}

export interface VideosConfig {
  videos?: VideoItem[]
}

export interface PressItem {
  outlet?: string
  quote?: string
  article_url?: string
  author?: string
  published_at?: string | null
}

export interface PressConfig {
  items?: PressItem[]
}

// --- Public EPK (unauthenticated /epk/{slug} page) ---
// Mirrors the builder's per-type configs, but already resolved server-side:
// media ids become URLs/file objects, and hidden Contact fields are blanked
// out rather than left for the frontend to filter.

export interface PublicHeroConfig {
  headline: string
  subtitle: string
  description: string
  profile_image_url: string | null
  background_image_url: string | null
  alignment: 'left' | 'center' | 'right'
  height: 'small' | 'medium' | 'large'
  overlay: boolean
  cta_label: string
  cta_url: string
}

export interface PublicBiographyConfig {
  html: string
}

export interface PublicSocialNetworksConfig {
  links: SocialLink[]
}

export interface PublicContactConfig {
  booking_email: string
  press_email: string
  management_email: string
  website: string
  phone: string
  address: string
}

export interface PublicDownloadFile {
  id: number
  filename: string
  url: string
  size: number
  mime_type: string
}

export interface PublicDownloadsConfig {
  files: PublicDownloadFile[]
}

export interface PublicCreditsConfig {
  items: CreditItem[]
}

export interface PublicCustomConfig {
  heading: string
  html: string
}

export interface PublicPhotoItem {
  url: string
  thumbnail_url: string
  caption: string
  credit: string
}

export interface PublicPhotosConfig {
  items: PublicPhotoItem[]
}

export interface PublicTrackItem {
  title: string
  provider: MusicProvider
  audio_url?: string
  mime_type?: string
  embed_url?: string
}

export interface PublicMusicConfig {
  tracks: PublicTrackItem[]
}

export interface PublicReleaseItem {
  title: string
  type: ReleaseType
  release_date: string | null
  cover_image_url: string | null
  links: ReleaseLinks
}

export interface PublicReleasesConfig {
  releases: PublicReleaseItem[]
}

export interface PublicVideoItem {
  title: string
  provider: VideoProvider
  embed_url?: string
  video_url?: string
  mime_type?: string
}

export interface PublicVideosConfig {
  videos: PublicVideoItem[]
}

export interface PublicPressItem {
  outlet: string
  quote: string
  article_url: string
  author: string
  published_at: string | null
}

export interface PublicPressConfig {
  items: PublicPressItem[]
}

export interface PublicEpkSection {
  id: number
  type: SectionType
  title: string
  config: Record<string, unknown>
}

export interface PublicArtist {
  id: number
  workspace_id: number
  name: string
  stage_name: string | null
  short_bio: string | null
  country: string | null
  city: string | null
  genre: string | null
  website: string | null
  booking_email: string | null
  press_email: string | null
  management_email: string | null
  profile_image_url: string | null
  cover_image_url: string | null
  created_at: string
  updated_at: string
}

export interface DnsRecordInstruction {
  type: 'TXT' | 'CNAME'
  host: string
  value: string
}

export interface CustomDomainSetup {
  domain: string
  verified: boolean
  verification_record: DnsRecordInstruction
  routing_record: DnsRecordInstruction
}

export interface PublicEpk {
  title: string
  slug: string
  theme: string
  custom_settings: Record<string, unknown> | null
  seo_title: string | null
  seo_description: string | null
  cover_image_url: string | null
  published_at: string | null
  artist: PublicArtist | null
  sections: PublicEpkSection[]
}

// --- Private Links ---

export interface PrivateLink {
  id: number
  label: string | null
  private_url: string
  requires_password: boolean
  expires_at: string | null
  revoked_at: string | null
  is_active: boolean
  view_count: number
  last_viewed_at: string | null
  created_at: string
}

// --- Analytics ---

export type AnalyticsEventType = 'page_view' | 'download' | 'audio_play' | 'video_play'

export interface AnalyticsTotals {
  page_views: number
  unique_visitors: number
  downloads: number
  audio_plays: number
  video_plays: number
}

export interface AnalyticsDailyPoint {
  date: string
  count: number
}

export interface AnalyticsReferrer {
  referrer: string
  count: number
}

export interface AnalyticsCountry {
  country: string
  count: number
}

export interface AnalyticsDeviceBreakdown {
  device_type: string
  count: number
}

export interface AnalyticsDownload {
  filename: string
  count: number
}

export interface AnalyticsPrivateLinkBreakdown {
  label: string
  count: number
}

export interface AnalyticsSummary {
  from: string
  to: string
  totals: AnalyticsTotals
  daily_page_views: AnalyticsDailyPoint[]
  top_referrers: AnalyticsReferrer[]
  top_countries: AnalyticsCountry[]
  devices: AnalyticsDeviceBreakdown[]
  top_downloads: AnalyticsDownload[]
  top_private_links: AnalyticsPrivateLinkBreakdown[]
}

// --- Contacts ---

export type ContactCategory = 'journalist' | 'radio' | 'blog' | 'label' | 'booking' | 'management' | 'pr' | 'other'

export interface Contact {
  id: number
  workspace_id: number
  name: string
  email: string | null
  phone: string | null
  category: ContactCategory
  category_label: string
  organization: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ContactImportSummary {
  created: number
  skipped: number
  errors: string[]
}

export interface ApiCollection<T> {
  data: T[]
}

export interface ApiResource<T> {
  data: T
}

export interface ApiPaginated<T> {
  data: T[]
  meta: { current_page: number; last_page: number; total: number }
}

export interface ApiErrorBody {
  message: string
  errors?: Record<string, string[]>
}

// --- Admin panel ---

export interface AdminUser {
  id: number
  name: string
  email: string
  role: UserRole
  avatar_url: string | null
  email_verified_at: string | null
  suspended_at: string | null
  created_at: string
}

export interface AdminWorkspace {
  id: number
  name: string
  slug: string
  members_count: number
  epks_count: number
  plan: SubscriptionPlan | null
  creator: { id: number; name: string } | null
  created_at: string
}

export interface AdminEpk {
  id: number
  title: string
  slug: string
  status: EpkStatus
  workspace: { id: number; name: string } | null
  artist: { id: number; name: string } | null
  published_at: string | null
  created_at: string
}

// The member-facing counterpart to AuditLogEntry — scoped to one workspace,
// and without the admin-only subject_type/subject_id/ip_address fields (see
// backend/app/Http/Controllers/Api/WorkspaceActivityLogController.php).
export interface WorkspaceActivityLogEntry {
  id: number
  action: string
  metadata: Record<string, unknown> | null
  user: { id: number; name: string } | null
  created_at: string
}

export interface SearchEpkResult {
  id: number
  title: string
  slug: string
  status: EpkStatus
}

export interface SearchArtistResult {
  id: number
  name: string
}

export interface SearchContactResult {
  id: number
  name: string
  email: string | null
}

export interface SearchMediaResult {
  id: number
  filename: string
  type: MediaType
  thumbnail_url: string | null
}

export interface GlobalSearchResults {
  epks: SearchEpkResult[]
  artists: SearchArtistResult[]
  contacts: SearchContactResult[]
  media: SearchMediaResult[]
}

export interface AuditLogEntry {
  id: number
  action: string
  subject_type: string | null
  subject_id: number | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user: { id: number; name: string } | null
  created_at: string
}

export interface AdminStats {
  users: { total: number; new_last_7_days: number; new_last_30_days: number }
  workspaces: { total: number }
  epks: { total: number; published: number; draft: number; archived: number }
  media: { total: number; storage_bytes: number }
  contacts: { total: number }
  analytics: { total_page_views: number; page_views_last_30_days: number }
}

// --- Billing ---

export interface PlanDetails {
  plan: SubscriptionPlan
  label: string
  max_epks: number | null
  max_storage_bytes: number | null
  max_team_members: number | null
  custom_themes: boolean
  private_links: boolean
  white_label: boolean
  custom_domains: boolean
}

export interface BillingUsageMetric {
  used: number
  limit: number | null
}

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due'

export interface BillingData {
  plan: SubscriptionPlan
  subscription_status: SubscriptionStatus | null
  current_period_ends_at: string | null
  has_stripe_customer: boolean
  usage: {
    epks: BillingUsageMetric
    team_members: BillingUsageMetric
    storage_bytes: BillingUsageMetric
  }
  plans: Record<SubscriptionPlan, PlanDetails>
}
