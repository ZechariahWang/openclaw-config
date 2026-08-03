
DISCORD_USER_ID="637824014168883221"

CHOICE="$1"

if [ -z "$CHOICE" ]; then
  echo "Current model status:"
  openclaw models status
  echo ""
  echo "Usage: ./set-model.sh [sonnet|opus|<model-id>]"
  exit 0
fi

case "$CHOICE" in
  sonnet) MODEL="claude-cli/claude-sonnet-5" ;;
  opus)   MODEL="claude-cli/claude-opus-4-8" ;;
  *)      MODEL="$CHOICE" ;;
esac

echo "Setting default model to: $MODEL"
openclaw models set "$MODEL" || exit 1

echo "Sending confirmation DM..."
openclaw message send --channel discord --target "user:$DISCORD_USER_ID" \
  -m "Model changed: I am now running on $MODEL."

echo "Done."
