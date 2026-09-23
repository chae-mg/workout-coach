process.env.WORKOUT_PREVIEW = 'gas';
if (process.platform === 'win32') process.env.WORKOUT_BROWSER_CHANNEL ??= 'msedge';
await import('./test-browser.js');
