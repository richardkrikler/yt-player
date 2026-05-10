import { getYoutubeClientForUser } from '../../../utils/youtube'
import { requireAuth } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  if (!user.youtubeConnected) {
    throw createError({ statusCode: 403, message: 'YouTube account not connected' })
  }

  const youtube = await getYoutubeClientForUser(user.id)
  const items: any[] = []
  let pageToken: string | undefined

  do {
    const res = await youtube.playlists.list({
      part: ['snippet', 'contentDetails', 'status'],
      mine: true,
      maxResults: 50,
      pageToken,
    })
    items.push(...(res.data.items ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return items.map(item => ({
    id: item.id,
    title: item.snippet?.title,
    description: item.snippet?.description,
    channelTitle: item.snippet?.channelTitle,
    itemCount: item.contentDetails?.itemCount,
    privacyStatus: item.status?.privacyStatus,
    thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url,
  }))
})
