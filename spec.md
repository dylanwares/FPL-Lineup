# FPL Lineup — Product Spec

Oct 11, 2026 · @Dylan Wares

## Overview

FPL Lineup is a mobile-first Fantasy Premier League planner, rebuilt from scratch at fpllineup.com. It keeps the original's look and its pitch-based planning flow. The difference is speed: switching gameweeks and making subs or transfers happen in the browser, so they never wait on the network.

**Goals**

- A new visitor goes from entering a team ID to planning a future gameweek in under 10 seconds.
- Sub mode and transfer mode let a user make any swap in two taps.
- Gameweek switches, subs and transfers feel instant on a mid-range phone (targets under Performance).
- Users keep several named plans per team. Plans sync across devices once the user signs in.

**Non-goals for v1**

- Live points, live rank and bonus, which the official app already covers.
- Rival and mini-league comparison, planned for a later release.
- Native apps. v1 ships as a responsive web app that can be installed as a PWA.
- Pushing transfers to the user's real FPL account. FPL Lineup plans; the user confirms transfers in the official app.

## Decisions

The app shares its stack and database with your FPL tracker. Anyone can plan from a team ID without signing up.

| Area | Decision | Reason |
| --- | --- | --- |
| Stack | Next.js (App Router) and TypeScript, with Postgres, hosted on Vercel | Same setup as the FPL tracker, so the Python ingestion service and player, fixture and projection data are shared |
| Accounts | Team ID with no sign-up; an optional account (Auth.js with email magic link or Google) syncs plans | Planning starts with no friction, and accounts unlock cross-device use |
| Plan storage | IndexedDB on the device, synced to Postgres when signed in | Every edit is saved locally first, so it is instant and works offline |
| Platform | Responsive web app, installable as a PWA | One codebase; can be added to a phone's home screen |
| v1 scope | Pitch planner, chips, sub mode, transfer mode, named plans, projected points metric, fixture ticker | Your v1 picks |
| Later | Rival and mini-league compare | Left out of v1 |

## Look and feel

The rebuild keeps the original layout and branding, with a light theme as in the original. On the planner screen, elements appear from top to bottom in this order:

1. **Header.** The crowned FPL Lineup wordmark on the left and an account icon on the right, on a white bar.
2. **Plan bar.** A plan dropdown (for example "Free hit GW18"), followed by icon buttons for new, rename and delete.
3. **Gameweek navigation.** A Previous pill, "Gameweek N" in the centre, and a Next pill. The pills use a mint-to-cyan gradient. Under them is the deadline countdown with the deadline in the user's local time.
4. **Metric row.** A metric dropdown and a toggle between player photos and shirts.
5. **Stats row.** Transfers (used / free), Bank (£m) and Cost (points hit).
6. **Chips row.** Wildcard, Free hit, Triple Captain and Bench Boost. Grey means used or unavailable, cyan means available, and solid purple means played in this gameweek.
7. **Pitch.** Striped green with white markings and FPL Lineup advertising boards at the top, which brand any screenshots users share. Each player shows a kit, a name pill and a metric pill. The metric pill is coloured by fixture difficulty, from green for easy to red for hard.
8. **Badges.** C and V appear as purple circles. A yellow warning triangle marks a doubt, and a red one marks an injury or suspension. A flagged player's name pill turns orange.
9. **Bench.** A lighter green strip below the pitch holding four players in priority order.
10. **Mode buttons.** Sub and Transfer toggles directly under the bench (see the next sections).

**Visual tokens.** Text and primary UI use FPL deep purple (about #37003C). The pitch uses PL green, and accents run mint to cyan. Headings use a condensed display face such as Oswald, and body text uses a system sans.

**Change from the original.** The original used official club shirts. The rebuild draws generic kits in each club's colours, which avoids licensed imagery and keeps 20 small SVGs in place of hundreds of images.

## Core features

Everything is centred on one planner screen; the fixture ticker is the only other page.

### Connect a team

- The user enters their FPL team ID. A short help link shows where to find it in the FPL site's URL.
- One server call imports the current squad, bank, free transfers, chips used, transfer history and derived selling prices. The ID is remembered on the device.
- Season rules, such as the maximum number of banked free transfers and the number of each chip, live in a config file. When FPL changes the rules for a season, only the config changes, not the code.

### Planner pitch

- A plan covers every gameweek from the next deadline to GW38. A change in gameweek N carries forward into N+1 and later gameweeks.
- Outside sub and transfer mode, tapping a player opens a player sheet. The sheet offers Make captain, Make vice and Details (fixtures, form, price, projections).
- Past gameweeks are read-only and show the team the user actually picked.

### Gameweek navigation

- The Previous and Next pills move between gameweeks, and a horizontal swipe on the pitch does the same.
- The deadline countdown shows the time remaining and the deadline in local time, for example "Saturday 9 Dec, 11:00".

### Metric dropdown

The dropdown sets the pill under each player's name:

- Next fixture (default)
- Projected points for this gameweek
- Projected points over the next 3 or 5 gameweeks
- Form
- Price
- Selected by %
- Total points

In a double gameweek both fixtures are shown. In a blank gameweek the player is greyed out with a dash. Projected points come from the tracker's expected-points model.

### Stats row

- **Transfers:** used / free, for example 1/1.
- **Bank:** shown in £m. A negative bank turns red and marks the plan as over budget, but the user can still make the move, so a sequence of transfers can be planned.
- **Cost:** a 4-point hit for each transfer beyond the free ones.
- **Projected points:** the gameweek total shown under the pitch. It applies the captain multiplier, the chip effects and the bench order.

### Chips

- The user plays a chip by tapping it. Only one chip can be played per gameweek.
- **Free hit:** the squad reverts the following gameweek.
- **Wildcard:** all transfers that gameweek are free.
- **Triple Captain:** the captain's points are tripled.
- **Bench Boost:** the bench counts towards projected points.

### Named plans

- Users can create, duplicate, rename and delete plans from the plan bar.
- Each plan stores its starting snapshot and a list of moves for each gameweek. Duplicating a plan copies both, which makes it easy to try an alternative route.

### Player list

- A bottom sheet used by transfer mode.
- Filtered by position, with search by name and filters by team and maximum price.
- Sorted by the current metric.
- Players the user cannot afford, and players who would break the three-per-club limit, are dimmed and show the reason (can still select these players for planning purposes, but this will put the balance in negative, display a warning for too many players in team etc.).

### Fixture ticker

- A grid of the 20 teams against the next 5 or 8 gameweeks (the user can switch between the two), coloured by FPL fixture difficulty.
- The grid can be sorted by average difficulty over the chosen range. Double gameweeks are marked with two fixtures in one cell, and blank gameweeks with an empty cell.
- A "My squad" filter shows only the teams the user's players come from.

## Sub mode and transfer mode

Two toggle buttons sit directly under the pitch: **Sub** and **Transfer**. Only one can be on at a time, and turning one on turns the other off. With both off, tapping a player opens the player sheet. Each mode stays on after a move, so the user can make several moves in a row.

### Sub mode

1. The user turns on Sub. The button fills in, and a thin outline round the pitch shows the mode is active.
2. The user taps a player. That player lifts and gets a highlight ring. Players who could legally swap with them stay bright, and the rest dim.
3. The user taps a highlighted player and the two swap places at once. The selection clears.
4. Tapping the selected player again cancels the selection.

Rules:

- A valid line-up always keeps 1 goalkeeper, at least 3 defenders, at least 2 midfielders and at least 1 forward. A goalkeeper can only swap with the other goalkeeper.
- A swap between two bench players changes bench priority. A swap between two starters is not offered, because it changes nothing.
- If the captain or vice is moved to the bench, the armband passes to the player coming in, and a toast says so.

### Transfer mode

1. The user turns on Transfer.
2. The user taps the player to sell. The player list opens, filtered to that position, and can be filtered to what the user can afford with their bank plus the outgoing player's selling price (a toggle).
3. The user taps the player to buy. The new player takes the same slot (starter or bench), and Bank, Transfers and Cost update at once. The change carries forward to later gameweeks.
4. A toast reads "Sold X, bought Y" with an Undo button. Each gameweek also has a Reset button that clears all of its moves.

Rules:

- The squad must keep 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards, with at most 3 players from any club.
- Selling a player returns their selling price: purchase price plus half of any rise in price, rounded down to £0.1m.
- Buying back a player sold earlier in the same plan cancels both moves. The original price and the transfer used are restored, and any hit is refunded.
- Unused free transfers roll over up to the season's limit from the rules config. A wildcard or free hit makes every transfer that gameweek free.

## Performance

In the old app, switching gameweeks and making subs or transfers were the slow spots. In the rebuild, all of these run entirely in the browser against data loaded once, so none of them makes a network call.

| Interaction | Target (mid-range Android, p75) |
| --- | --- |
| Gameweek switch | Renders in under 50 ms, with no network request |
| Sub or transfer | On screen in under 50 ms; INP under 200 ms across the app |
| Opening the player list (about 700 players) | Under 100 ms, with smooth 60 fps scrolling |
| First visit on 4G | LCP under 2.0 s; planner JavaScript under 150 KB gzipped |
| Repeat visit | Interactive in under 1 s from cache |

**How the targets are met**

- **One bootstrap file.** A single compact JSON file holds all players, teams, fixtures and projections for the rest of the season. It is built from the shared database and served from the CDN under a content-hashed URL. The browser fetches it once, keeps it in IndexedDB, and checks a small version endpoint to see whether it has changed.
- **Plans as a move log.** A plan is a starting snapshot plus a list of moves. Each gameweek's squad is computed from these by a pure, memoised function. A change in gameweek N recomputes only N to 38, which is at most 38 squads of 15 players.
- **Fine-grained state.** The app uses a small store such as Zustand, with each component reading only the slice it needs. A transfer re-renders the two affected player slots and the stats row, not the whole page.
- **Light pitch.** The pitch is plain CSS grid and DOM elements. Kits are 20 inline SVGs coloured per club, and player photos load lazily only in photo view.
- **Local-first saving.** Every edit is written to IndexedDB immediately. Syncing to the server is debounced and runs in the background.
- **Server shell, client planner.** Server components render the page shell, and the planner is the only client-side island. The player list is virtualised.
- **Budgets enforced in CI.** Lighthouse CI and a bundle-size check fail the build when a limit is exceeded. Web-vitals reporting tracks INP on real users.

## Architecture

The server's job is to supply data. All planning logic runs in the browser.

&#91;embedded content: system architecture · 7 parts\]

The ingestion service and Postgres are shared with the FPL tracker. FPL Lineup adds three pieces: the bootstrap file, the team import proxy and plan sync.

### Data model

| Table | Key fields | Notes |
| --- | --- | --- |
| players, teams, fixtures, projections | Shared with the tracker | projections holds expected points per player per gameweek |
| users | id, email, created\_at | Created only when someone signs in |
| saved\_teams | user\_id, entry\_id, label | FPL team IDs linked to an account |
| plans | id, user\_id, entry\_id, name, base\_gw, base\_snapshot (jsonb), moves (jsonb), version, updated\_at | Anonymous users' plans live only in IndexedDB |

Each entry in `moves` has a gameweek, a type (transfer, sub, captain, vice or chip) and the player IDs involved.

### API

| Endpoint | Purpose | Caching |
| --- | --- | --- |
| GET /data/bootstrap.{hash}.json | All static game data | Immutable, served from the CDN |
| GET /api/version | Current bootstrap hash and gameweek | Short CDN cache |
| GET /api/team/{entryId} | Squad, bank, free transfers, chips used, selling prices | Cached for 5 minutes |
| GET, PUT /api/plans and /api/plans/{id} | Read and save plans (signed in) | None; the version field detects conflicting edits |

## Milestones, open questions and risks

The build runs in five stages. The planner core and the two modes come first, because that is where the old app fell short.

1. **Foundations.** Set up the Next.js app and design tokens, build the bootstrap JSON from the shared database, and add the performance budgets to CI.
2. **Planner core.** Team import, pitch, gameweek navigation, stats row, captaincy, and the plan engine with rule checks and saving on the device.
3. **Sub and transfer modes.** Both modes, the player list sheet, undo, and reset.
4. **Chips, plans and metrics.** The chips row, named plans, and the metric dropdown with projected points.
5. **Accounts, ticker and launch.** Sign-in and plan sync, the fixture ticker, and installing as a PWA.

**Open questions**

- [ ] Confirm the 2026/27 FPL rules: the maximum number of banked free transfers, and how many of each chip there are and when they can be played.
- [ ] Keep the light theme, or add the dark theme used in your tracker? The tracker should use both themes.
- [ ] Use FPL's fixture difficulty only, or add a custom difficulty rating? Use FPL FDR.
- [ ] Add "share lineup as image" in v1? Yes.
- [ ] Ship as a separate product from the FPL tracker, or merge the two later? Separate. This is a new product.
- [ ] How will the app make money: ads, a premium tier, or neither? For now, it is free, will add monetisation later.

**Risks**

| Risk | Mitigation |
| --- | --- |
| The FPL API is unofficial, rate-limited, can change between seasons, and is often unavailable around deadlines | Player data is served from our own database; the team import goes through a cached proxy with backoff |
| Selling prices derived from public transfer history can be off by £0.1m | Show derived prices with ≈ and let the user correct a price on a player's sheet |
| FPL and Premier League branding and imagery | Generic kits and no official logos; a disclaimer that the app is unaffiliated |
