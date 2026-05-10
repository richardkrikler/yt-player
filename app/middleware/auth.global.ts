const PUBLIC_PATHS = ['/login', '/register']

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value && !PUBLIC_PATHS.includes(to.path)) {
    return navigateTo('/login')
  }

  if (loggedIn.value && PUBLIC_PATHS.includes(to.path)) {
    return navigateTo('/')
  }
})
