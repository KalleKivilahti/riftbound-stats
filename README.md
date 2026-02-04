for fun site to farm best ofs :D
### TODO
general improvements, abysmal CSS
battlefields not working yet
1st or 2nd winrate
bug if game is too long
turn x card is drawn/played

### HOW TO INSTALL TRACKER EXTENSION
The github link
tracker folder
Download all the files to any folder
Go to browser extensions
Load unpacked choose the folder that has all and only the files from tracker
Youre done with installing
Open the tracker

### HOW TO USE THE TRACKER
Reload the tcg-arena tab
After you load or reload the extension, refresh the tcg-arena play page (F5) so the content script is injected again with a valid context.
Recommended order: reload extension → then reload tcg-arena tab.
Open the tracker
Click the extension icon to open the tracker window.
Set TCGA Nick. Type your in-game name exactly as it appears in chat.
Play on tcg-arena
On https://tcg-arena.fr/play the extension will read chat lines and update the tracker.
Record the result
After the game, click Record win or Record loss. When you do, the tracker scans the full chat history for every `played <card>` line so the final log is guaranteed to match what both players actually played. You can still set Opponent legend and the record will automatically push the data to the database where the site pulls it from

### HOW TO USE THE SITE

Go to: 
https://riftblazing.netlify.app/ (knowers know)

**Import JSON (optional)**  
You can still drag or paste exported JSON on the Import page for convenience; data is stored in the browser and used if Supabase is not configured or fails.