#!/usr/bin/env bash

DISCORD_USER_ID="637824014168883221"
EMAIL_JOB_ID="eb4da821-e6c8-4e93-93ff-07f20ae7d5c5"

SCHEDULE="0 8 * * *"
TIMEZONE="America/Los_Angeles"

PROMPT="Check my email inboxes: personal (zechariahwang@gmail.com) and school (z2789wan@uwaterloo.ca). \
Summarize anything new since the last check: who it is from, what it is about, and \
whether it needs a reply or action. Lead with anything urgent or time-sensitive \
(deadlines, professors, appointments). Skip promotions and newsletters unless \
genuinely important. Keep it short and simple to read, no emojis. If you cannot \
access an inbox, say so clearly instead of guessing."

if [ -z "$EMAIL_JOB_ID" ]; then
  echo "Creating the email-update cron job..."
  openclaw cron add --name "email-update" --cron "$SCHEDULE" --tz "$TIMEZONE" \
    --session isolated --message "$PROMPT" \
    --announce --channel discord --to "user:$DISCORD_USER_ID" || exit 1
  echo ""
  echo ">>> Copy the \"id\" value from the JSON above and paste it into EMAIL_JOB_ID in this script."
  exit 0
fi

echo "Updating job settings (prompt + schedule + Discord DM target)"
openclaw cron edit "$EMAIL_JOB_ID" --message "$PROMPT" --cron "$SCHEDULE" --tz "$TIMEZONE" \
  --to "user:$DISCORD_USER_ID" || exit 1

echo "Firing a test run"
openclaw cron run "$EMAIL_JOB_ID"

echo "Run history (newest first):"
openclaw cron runs --id "$EMAIL_JOB_ID"
