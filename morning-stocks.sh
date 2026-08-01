#!/usr/bin/env bash

DISCORD_USER_ID="637824014168883221"

JOB_ID="283e4917-8882-45fb-bf72-0d127fa90044"

PROMPT="Give me this morning's tech stock briefing focused on semiconductors and AI. \
Search the web for the latest news and premarket/overnight moves on NVDA, AMD, TSM, \
AVGO, INTC, MU, ARM, plus AI-heavy megacaps (MSFT, GOOGL, META). Include: notable \
price moves and why, key headlines, earnings or analyst actions, and anything \
upcoming today. Keep it concise enough for a single Discord message. No emojis, no emdashes, make it extremely short and simple to read \
give reccomended future steps, but DONT use it as financial advice"

if [ -z "$DISCORD_USER_ID" ]; then
  echo "smt went wrong, enter user id"
  exit 1
fi

echo "Updating job settings (prompt + Discord DM target)"
openclaw cron edit "$JOB_ID" --message "$PROMPT" --to "user:$DISCORD_USER_ID" || exit 1

echo "Firing a test run"
openclaw cron run "$JOB_ID"

echo "Run history (newest first):"
openclaw cron runs --id "$JOB_ID"
