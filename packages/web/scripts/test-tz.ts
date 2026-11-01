// Runs `bun test` once per device time zone; the time helpers depend on the
// zone's offsets and DST rules (including midnight and 30/45-minute shifts).
const zones = [
  'America/New_York',
  'America/Asuncion',
  'America/Havana',
  'America/Santiago',
  'Australia/Lord_Howe',
  'Asia/Kathmandu',
  'America/St_Johns',
  'Pacific/Chatham',
  'Europe/London',
  'UTC',
];

for (const tz of zones) {
  console.log(`\n=== TZ=${tz} ===`);
  const { exitCode } = Bun.spawnSync(
    ['bun', 'test', ...process.argv.slice(2)],
    {
      env: { ...process.env, TZ: tz },
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  if (exitCode !== 0) {
    console.error(`bun test failed with TZ=${tz}`);
    process.exit(exitCode ?? 1);
  }
}
