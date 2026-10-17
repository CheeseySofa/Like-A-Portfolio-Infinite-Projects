/* =====================================================================
   music-config.js - the ONE place to set up the music.
   Used by start.js (title screen) and home-music.js (home page).
   ===================================================================== */
const MUSIC = {
    // PLACEHOLDER: replace with your own file, e.g. 'audio/title-theme.mp3'
    src: 'audio/title-theme-placeholder.wav',
    volume: 0.8,         // 0 to 1
    startAt: 0,          // seconds into the file where the title music starts / its loop restarts
    loopEnd: null,       // title screen only: seconds where it jumps back to startAt.
                         //   null = play the whole file and loop it
                         //   60   = loop only the first minute (like the game's title screen)
    fadeIn: 1500,        // ms
    fadeOut: 900,        // ms
    continueOnHome: true // keep the music going on the home page after the title screen
                         // (there the whole file plays on, so with loopEnd: 60 you hear the rest of the song)
};
