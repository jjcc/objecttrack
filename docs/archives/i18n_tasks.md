# i18n Implementation Tasks — Object Tracking App

**Goal:** Add runtime-switchable English and Simplified Chinese to every user-facing UI surface.

**Implementation status (2026-08-03): Complete.** The scoped UI now uses validated cookie-based locale selection, aligned English and Simplified Chinese catalogues (750 messages each), localized metadata/statuses/dates/validation/action feedback, and switchers on authenticated, public, tenant-admin, platform-operations, and not-found surfaces. Catalogue parity, TypeScript, production build, and browser checks pass. The optional follow-up scope remains unchanged.

**Scope:** UI copy, validation, notifications, status labels, metadata, and locale-aware date/number formatting. No database schema change or data migration is required.

**Recommended stack:** `next-intl`, without locale-based routing. Existing flat URLs such as `/dashboard` remain unchanged.

---

## Review findings

The original direction was sound, but the implementation details and effort estimate needed adjustment:

- `src/app/layout.tsx` is currently a Client Component. Reading a server cookie and inheriting `next-intl` request configuration requires the root layout to become a Server Component; Mantine, notifications, analytics, and `AuthGate` should move into a dedicated client-side providers component.
- The app already has Supabase authentication middleware. Since locales are not part of the URL, `next-intl` routing middleware and navigation wrappers are unnecessary and should not be introduced. This avoids middleware composition and redirect regressions.
- `localStorage` is not suitable as the source of truth because Server Components, `<html lang>`, and metadata cannot read it. Use a validated cookie and refresh the current route after switching.
- A header-only switcher would not be available on login, registration, password reset, invitation acceptance, public object information, unauthorized, MFA, and not-found screens. The reusable switcher needs placements for authenticated and public shells.
- The inventory is closer to 60 UI-bearing TSX files, not 30. It also includes Server Action feedback, Zod/form validation, notifications, enum/status labels, accessibility text, dates, and date-picker chrome.
- `npm run build` alone does not guarantee complete catalogues or detect every untranslated literal. Add catalogue parity/type checks and test both locales.
- The previous 4–6 hour estimate is optimistic for complete coverage and QA. A realistic first pass is 1–2 engineering days, plus translation review.

## Decisions to confirm

- Use `en` and `zh-CN` (Simplified Chinese). Traditional Chinese should be a separate future locale such as `zh-TW`; do not put both variants under a generic `zh` catalogue.
- English remains the deterministic first-visit default. Do not infer from `Accept-Language` in the first release unless product requirements call for it.
- Database-owned/user-authored values (tenant names, object names, group names, custom-field names, event-type labels, and free-text reasons) remain as stored. Translate application-owned enum values such as `pending`, `approved`, `active`, and `suspended` at render time without changing the values sent to Supabase.
- Invitation email content, CSV headers/content, and raw API response bodies are outside the current UI scope. Add them as explicit follow-up work if exported and emailed artifacts must also be bilingual.

---

## Target architecture

### Files to add

```text
messages/
  en.json
  zh-CN.json
src/i18n/
  config.ts        # locales, default locale, cookie name, locale guard
  request.ts       # validated cookie -> locale -> messages
  actions.ts       # validated server action that sets the locale cookie
src/app/
  providers.tsx    # existing client-only providers and NextIntlClientProvider
src/components/i18n/
  LocaleSwitcher.tsx
```

### Request flow

1. `src/i18n/request.ts` reads `NEXT_LOCALE` with `cookies()`.
2. The value is checked against the supported locale tuple; invalid/missing values fall back to `en`.
3. Only the selected JSON catalogue is dynamically imported.
4. The Server Component root layout calls `getLocale()`, sets `<html lang={locale}>`, and renders `NextIntlClientProvider` above the client providers.
5. The switcher calls a validated Server Action to set `NEXT_LOCALE` (`path=/`, `sameSite=lax`, one-year lifetime, secure in production), then calls `router.refresh()`. The URL and navigation history do not change.

This design deliberately does **not** use a `[locale]` route segment, `defineRouting`, `createNavigation`, or `next-intl` middleware. Continue using `next/link` and `next/navigation` throughout the app.

---

## Implementation plan

### 1. Install and configure `next-intl`

- Install a version compatible with the repository's Next.js 14 and React 18 versions and commit both `package.json` and `package-lock.json`.
- Wrap `next.config.mjs` with `createNextIntlPlugin("./src/i18n/request.ts")`.
- Define a single source of truth in `src/i18n/config.ts`, for example:

```ts
export const locales = ["en", "zh-CN"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";
export const localeCookieName = "NEXT_LOCALE";
```

- Validate the cookie before using it in a dynamic import. Never interpolate an unchecked cookie value into a file path.
- Add `next-intl` TypeScript augmentation using the English catalogue shape so invalid message keys are compile-time errors.

### 2. Split the root layout at the server/client boundary

- Remove `"use client"` from `src/app/layout.tsx`.
- Move `MantineProvider`, `Notifications`, `AuthGate`, and any other browser-only providers into `src/app/providers.tsx`.
- Render `NextIntlClientProvider` from the server layout so Client Components inherit `locale` and `messages` from `src/i18n/request.ts`.
- Set `<html lang={locale}>` on every request.
- Replace the hard-coded `<title>` with localized `generateMetadata`. Include descriptions if/when they are added.
- Keep global CSS imports in the root layout unless a build confirms they are valid in the providers file.

### 3. Implement locale switching

- Create one accessible `LocaleSwitcher` using `useLocale`, a native/select-style control or Mantine menu, visible labels (`English`, `简体中文`), and an `aria-label` from the catalogue.
- Use the Server Action in `src/i18n/actions.ts` to validate and set the cookie. Disable the control while the update is pending and call `router.refresh()` after success so Server and Client Components update together.
- Place it in the authenticated header and in a consistent public/auth location. Verify it is reachable on login, register, forgot-password, invitation acceptance, public object info, MFA, unauthorized, and not-found pages.
- Do not use `localStorage`, directly mutate unvalidated cookies from the browser, redirect to a locale URL, or reload with `window.location`.

### 4. Build the message catalogues

- Use feature/component namespaces rather than one large `common` bucket. Share only genuinely context-independent actions such as Save, Cancel, Back, and Close.
- Use semantic keys (`Transfers.approveSuccess`), not English text as keys (`Transfers.approvalSuccessful`).
- Use ICU arguments and plurals instead of string concatenation:

```json
{
  "Dashboard": {
    "recentEventsDays": "Recent events ({days} days)",
    "objectCount": "{count, plural, =0 {No objects} =1 {One object} other {# objects}}"
  }
}
```

- Keep both catalogue trees exactly aligned. Add a script that recursively compares leaf keys and fails on missing/extra keys.
- Avoid embedding markup in messages unless `t.rich` is genuinely needed. Keep technical identifiers and user data as interpolation arguments.

### 5. Translate by vertical slice

Convert related pages together so each workflow is usable in both languages before moving on:

1. **Foundation and public auth:** root metadata, login, registration, forgot password, MFA, unauthorized, not-found, invitation acceptance, and `LoginForm`.
2. **Application shell:** `Header`, `Sidebar`, `AppShell`, shared buttons, breadcrumbs, and empty/loading states.
3. **Core inventory:** dashboard, objects, public object info, barcode/QR/scan, users, and groups (list/detail/create/edit).
4. **Operations:** events and transfers (list/detail/create, filters, dialogs, notifications, and badges).
5. **Settings:** settings landing page, categories, event types, custom fields, tenant redirect/help copy, and profile.
6. **Administration:** tenant admin pages/components, invitations, members, audit, reports, platform ops pages/components, and layouts.
7. **Shared components:** `ObjectExtendedFields`, `EventTypeBadge`, `ObjectBarcodeGenerator`, `ObjectQrCode`, `UserDisplay`, and any accessible labels/tooltips they render.

For synchronous Client Components use `useTranslations`. For async Server Components, layouts, Server Actions, and metadata use `getTranslations`. Do not convert a Server Component to a Client Component solely to translate it.

### 6. Localize validation and server feedback

- Build Zod schemas that contain user-facing messages inside a component/function with access to `t`, or translate stable Zod issue codes at the presentation layer. Module-level English schema messages will otherwise remain English.
- Replace concatenated messages with ICU parameters.
- Change Server Action result types to return stable application codes plus interpolation data where practical (for example `{code: "invitationRevoked"}`), and translate them in the rendering component. This keeps business logic language-neutral.
- Do not display raw Supabase/backend error messages directly. Log the original error for diagnostics, map known error codes to localized messages, and show a localized generic fallback for unknown errors. Authentication pages need a specific mapping pass.
- Translate notifications, modal titles, confirmation text, placeholders, helper text, button pending labels, and empty/error states—not only headings and field labels.

### 7. Localize statuses, dates, and controls

- Map application-owned raw status values through catalogue keys while preserving raw values for comparisons, filters, form submissions, and database writes. Cover at least transfer, tenant, invitation/delivery, report-job, MFA, and action-result statuses.
- Replace `dayjs(...).format(...)` and browser-default `toLocaleString()`/`toLocaleDateString()` used for presentation with `next-intl` `useFormatter`/`getFormatter` and named formats. This ensures the selected app locale, rather than the browser or server default, controls output.
- Configure Mantine date controls with the selected locale (including the appropriate Day.js locale data), so month/day names and date-picker controls are translated.
- Keep timestamps stored and queried exactly as they are. Locale changes affect presentation only.
- Verify Chinese layout at typical and narrow widths; text expansion can also occur in English, so do not use fixed widths based on either language.

### 8. Add automated checks

- Add `npm run i18n:check` to verify JSON syntax and exact leaf-key parity between `en.json` and `zh-CN.json`.
- Run TypeScript/build checks so mistyped keys and invalid ICU messages are caught.
- Add focused tests for locale validation/fallback and the locale-setting action if a test runner is introduced.
- Optionally add a narrow untranslated-literal audit for TSX, with an allowlist for technical/data strings. Treat it as a review aid, not proof of completeness.

### 9. Validate end to end

Automated:

- `npm run i18n:check`
- `npx tsc --noEmit`
- `npm run build`

Manual, in both locales:

- First visit without a cookie renders English and `<html lang="en">`.
- Switching to Chinese updates the current route and `<html lang="zh-CN">`, preserves query parameters/form-safe navigation, and survives navigation and a new tab.
- An invalid locale cookie safely falls back to English without a failed dynamic import.
- Auth redirects and Supabase session refresh still work because the existing middleware is unchanged.
- Exercise login failure, registration validation, password reset, MFA, invitation errors, CRUD validation, transfer approval/rejection, tenant admin actions, and report states.
- Check dates, filters, date pickers, status badges, notifications, dialogs, breadcrumbs, empty states, mobile navigation, public pages, metadata, and 404 behavior.
- Confirm user-authored/database-owned content is not incorrectly used as a translation key.
- Inspect browser and server consoles for missing-message or hydration errors.

---

## Definition of done

- Every user-visible application-owned string in the scoped UI is available in `en` and `zh-CN`.
- The switcher is accessible on authenticated and public screens, persists via a validated cookie, and changes language without changing URLs.
- Server Components, Client Components, metadata, validation, notifications, and Server Action feedback agree on the selected locale.
- Application statuses and date/date-picker presentation are localized without changing stored values.
- Catalogue parity, TypeScript, and production build checks pass.
- Existing authentication, authorization, deep links, query strings, and flat routes behave exactly as before.

## Follow-up scope (optional)

- Localized invitation emails and locale selection for recipients.
- Localized CSV headers/report artifacts and filenames.
- Persisting locale in the user profile for cross-device preference (requires a schema/product decision).
- Browser language negotiation for first-time visitors.
- Traditional Chinese (`zh-TW`).

## Effort estimate

- Architecture, cookie switcher, and checks: 3–5 hours.
- Catalogue extraction and component conversion: 6–12 hours.
- QA, translation review, and fixes: 3–6 hours.

**Total:** approximately 1–2 engineering days, plus native-speaker/product review of the Chinese catalogue.
