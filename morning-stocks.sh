#!/usr/bin/env bash

DISCORD_USER_ID="637824014168883221"
JOB_ID="283e4917-8882-45fb-bf72-0d127fa90044"

SCHEDULE="0 8 * * *"
TIMEZONE="America/Edmonton"

PROMPT="Give me this morning's tech stock briefing focused on semiconductors and AI. \
Search the web for the latest news and premarket/overnight moves on NVDA, AMD, TSM, \
AVGO, INTC, MU, ARM, plus AI-heavy megacaps (MSFT, GOOGL, META). Include: notable \
price moves and why, key headlines, earnings or analyst actions, and anything \
upcoming today. Keep it concise enough for a single Discord message. No emojis, no emdashes, make it extremely short and simple to read \
give reccomended future steps, but DONT use it as financial advice \
if related tech stocks earnings reports are closing, update me so i can be on the lookout."

if [ -z "$DISCORD_USER_ID" ]; then
  echo "smt went wrong, enter user id"
  exit 1
fi

if [ -z "$JOB_ID" ]; then
  echo "Creating the morning-stocks cron job..."
  openclaw cron add --name "morning-stocks" --cron "$SCHEDULE" --tz "$TIMEZONE" \
    --session isolated --message "$PROMPT" \
    --announce --channel discord --to "user:$DISCORD_USER_ID" || exit 1
  echo ""
  echo ">>> Copy the \"id\" value from the JSON above and paste it into JOB_ID in this script."
  exit 0
fi

echo "Updating job settings (prompt + schedule + Discord DM target)"
openclaw cron edit "$JOB_ID" --message "$PROMPT" --cron "$SCHEDULE" --tz "$TIMEZONE" \
  --to "user:$DISCORD_USER_ID" || exit 1

echo "Firing a test run"
openclaw cron run "$JOB_ID"

echo "Run history (newest first):"
openclaw cron runs --id "$JOB_ID"
