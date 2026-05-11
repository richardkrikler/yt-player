export default defineNuxtPlugin(() => {
  const router = useRouter()

  function routeDepth(path: string) {
    return path.startsWith('/playlist/') ? 1 : 0
  }

  router.beforeEach((to, from) => {
    const html = document.documentElement
    const toD = routeDepth(to.path)
    const fromD = routeDepth(from.path)
    if (toD > fromD) html.dataset.vt = 'forward'
    else if (toD < fromD) html.dataset.vt = 'back'
    else delete html.dataset.vt
  })

  router.afterEach(() => {
    // Clear after each navigation; CSS animations continue to completion
    // even after the attribute is removed, so timing is safe.
    delete document.documentElement.dataset.vt
  })
})
