// The admin users UI calls /api/admin/users. The handler logic already lives under
// app/[locale]/admin/users/api/route.ts — re-export it here so the canonical path works
// without duplicating the business logic.
export { GET, POST, PATCH } from '@/app/[locale]/admin/users/api/route';
