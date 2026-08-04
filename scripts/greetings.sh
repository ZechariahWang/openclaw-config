#!/usr/bin/env bash

DISCORD_USER_ID="637824014168883221"
JOB_ID="19881b99-ca22-4d56-802e-96f6e8001664"

SCHEDULE="0 8 * * *"
TIMEZONE="America/Edmonton"
CITY="Edmonton"

PROMPT="Send zech a short, warm morning greeting. Open with something like: \
\"Good morning zech, preparing your daily updates.\" Then give this morning's conditions \
for $CITY: the current local time, temperature in Celsius with feels-like, the sky/weather \
description, wind (speed in km/h plus direction), and precipitation. Get the weather by \
running: curl -s 'https://wttr.in/$CITY?format=j1' and read current_condition (temp_C, \
FeelsLikeC, weatherDesc, windspeedKmph, winddir16Point, precipMM). Keep it to a few short, \
friendly lines. No emojis, no em dashes. If the weather fetch fails, still send the greeting \
and just say the weather is unavailable this morning."

if [ -z "$DISCORD_USER_ID" ]; then
  echo "smt went wrong, enter user id"
  exit 1
fi

if [ -z "$JOB_ID" ]; then
  echo "Creating the greetings cron job..."
  openclaw cron add --name "greetings" --cron "$SCHEDULE" --tz "$TIMEZONE" \
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
