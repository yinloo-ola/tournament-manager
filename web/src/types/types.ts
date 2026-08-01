// Canonical model lives in @/shared/model. This module re-exports it so existing
// imports (`@/types/types`) keep working during the feature-sliced migration.
// New code should import from @/shared/model directly.
export * from '@/shared/model'
