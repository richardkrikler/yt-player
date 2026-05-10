import { getAuthUrl } from '../../utils/youtube'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  return sendRedirect(event, getAuthUrl())
})
