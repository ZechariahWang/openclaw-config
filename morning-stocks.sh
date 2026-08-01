DISCORD_USER_ID="637824014168883221"

JOB_ID="283e4917-8882-45fb-bf72-0d127fa90044"

if [ -z "$DISCORD_USER_ID" ]; then
  echo "smt went wrong, enter user id"
  exit 1
fi

echo "Pointing the job at Discord DMs (user:$DISCORD_USER_ID)"
openclaw cron edit "$JOB_ID" --to "user:$DISCORD_USER_ID" || exit 1

echo "Firing a test run"
openclaw cron run "$JOB_ID"

echo "Run history (newest first):"
openclaw cron runs --id "$JOB_ID"
