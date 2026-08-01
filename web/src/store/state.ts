// The reactive tournament document lives in @/app/documentStore. Re-exported
// here so existing imports (`@/store/state`) keep working during the migration.
// New code should import from @/app/documentStore directly.
export { tournament } from '@/app/documentStore'
