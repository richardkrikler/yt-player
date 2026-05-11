// Module-level state: single source of truth for which elements currently
// carry view-transition-names (uniqueness is required by the spec).
let _namedImg: HTMLElement | null = null
let _namedTitle: HTMLElement | null = null
const _backId = { value: null as string | null }

function clearPlaylistVTNames() {
  if (_namedImg) { _namedImg.style.viewTransitionName = ''; _namedImg = null }
  if (_namedTitle) { _namedTitle.style.viewTransitionName = ''; _namedTitle = null }
}

function setPlaylistVTNames(img: HTMLElement | null, title: HTMLElement | null) {
  clearPlaylistVTNames()
  if (img) { img.style.viewTransitionName = 'playlist-thumb-expand'; _namedImg = img }
  if (title) { title.style.viewTransitionName = 'playlist-title-expand'; _namedTitle = title }
}

export function usePlaylistTransition() {
  return {
    // backId: set by the playlist page's onBeforeRouteLeave so the home
    // page knows which card to name for the back-navigation morph.
    backId: _backId,
    setPlaylistVTNames,
    clearPlaylistVTNames,
  }
}
