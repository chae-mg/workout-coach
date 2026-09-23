process.env.WORKOUT_PREVIEW = 'gas';
process.env.PORT ??= '4175';
await import('./serve.js');
