# Ultimate stacks

Ultimate is available at character level 1. New players start with one stack so they can use it immediately. There is no character-level unlock or battle-charge requirement.

- Each use consumes one saved stack and deals twice normal attack damage.
- Completing training on three consecutive local calendar days awards one stack, then again at streak days 6, 9, 12, and so on.
- Multiple completed sessions on one calendar day count only once.
- The maximum is three stacks. Extra awards while full are not banked.
- Missing a day resets earning progress but preserves existing stacks.
- Attack and Guard do not grant stacks. Stacks persist between battles and refreshes.

Older saves without a stack field receive one starter stack plus stacks corresponding to their recorded streak, capped at three. An explicit saved zero stays zero; refreshing does not replenish it.

## Database deployment

Apply `supabase/migrations/202611080003_ultimate_stacks.sql` after the first two migrations. It accepts the bounded `ultimateStacks` field, gives new database saves a starter stack, and prevents older clients from erasing saved stacks. Existing XP, rows, revisions and ownership policies are preserved. No hosted SQL migration was applied from this workspace.

Demo Controls provides **Next Training Day** to simulate consecutive completed training days and **Add Ultimate Stack** to test the resource directly. Demo changes stay in the demo save.
