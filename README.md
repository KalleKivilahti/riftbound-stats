for fun site to farm best ofs :D
### TODO
general improvements, abysmal CSS
battlefields not working yet
1st or 2nd winrate
bug if game is too long
turn x card is drawn/played

### HOW TO USE THE TRACKER
Reload the tcg-arena tab
After you load or reload the extension, refresh the tcg-arena play page (F5) so the content script is injected again with a valid context.
Recommended order: reload extension → then reload tcg-arena tab.
Open the tracker
Click the extension icon to open the tracker window.
Set “My name”. Type your in-game name exactly as it appears in chat.
Optional: paste your decklist
You can paste your deck for “cards left” and draw %. If you don’t, the tracker still records “your cards played” from the chat log.
Play on tcg-arena
On https://tcg-arena.fr/play the extension will read chat lines and update the tracker.
Record the result
After the game, click Record win or Record loss. Optionally set Opponent hero and use Export data when you want to move data to the stats site.

### SUPABASE INSERT (Record win/loss → PostgreSQL)
The tracker runs in the **browser** (Chrome extension). It cannot read Netlify env or a `.env` file. Two options:
1. Open the **tracker** (extension window).
2. Scroll to **Supabase – set once so Record win/loss INSERTs to your DB**.
3. Enter **Project URL** (e.g. `https://xxxx.supabase.co`) and **Anon key (Legacy)** from the Supabase dashboard.
4. Click **Save**.
5. From then on, every Record win/loss POSTs that game to Supabase (status shows “Synced” or “Sync failed”).
This uses the extension’s stored URL/key only. Netlify env vars are for server-side code, not for this flow. If you get 403, check Supabase → Table Editor → RLS: allow INSERT for anon on `games` and `game_cards` (or disable RLS for testing).

### HOW TO USE THE SITE

Go to: 
https://riftblazing.netlify.app/ (knowers know)
Import button top right at header
Drag the exported JSON there → load data → view stats