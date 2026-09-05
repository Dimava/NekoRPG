import 'uno.css'
import { mountIslands } from '../plugin/mount.js'

mountIslands(import.meta.glob('./islands/*.vue', { eager: true }))
