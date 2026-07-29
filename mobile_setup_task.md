# Flutter Mobile App — ObjectTrack
Status: scaffold complete, analyzer clean.

## Schema Changes Applied
- objects.current_owner_id added
- transfer_requests.group_id added
- RLS allows anonymous read of objects and authenticated transfer request creation

## Current Mobile State
- Repo: /home/jchen/workspaces/objtrack_mobil
- Git: local repo initialized on `master`
- Flutter: 3.35.7 (local install at /home/jchen/flutter)
- Analyzer: 0 errors, 0 warnings, 1 info

## Completed
- Flutter project created
- pubspec.yaml finalized (no duplicate keys)
- Core: theme, router, supabase init, widgets
- Features: login, home, scan, scan_result, object_details, transfer_request, my_requests, approvals, settings
- Repositories: auth, object, transfer, notification (stub)
- Background OpenCode process polishing `.gitignore`, unused imports, notification API, approval UX
- Git commit: `feat: initial Flutter app scaffold with analyzer clean`

## Remaining
- Push repo to remote (GitHub/GitLab)
- Implement notifications table + realtime listener in Supabase
- Test on Android/iOS via `flutter run`
- Upgrade to `publishableKey` param in supabase init to silence deprecation info
