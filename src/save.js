// The save, kept in the browser (localStorage). If storage is closed (private windows), the run still works:
// it just isn't remembered.
import { repair } from './meta.js'

const KEY = 'worldfall.save.v1'
export function loadSave() {
  try { return repair(JSON.parse(localStorage.getItem(KEY))) } catch { return repair(null) }
}
export function storeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)) } catch { /* not remembered, that's all */ }
}
