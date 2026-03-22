# Paperclip Telegram + ACP Runbook

## Purpose
Enable agent-to-human Telegram conversations in Paperclip using:
- `paperclip-plugin-telegram` (Telegram transport + `/acp` commands)
- `paperclip-plugin-acp` (ACP session bridge used by Telegram plugin)

## Source of Truth
- Plugin dependency set: `/paperclip/.paperclip/plugins/package.json`
- Plugin lockfile: `/paperclip/.paperclip/plugins/package-lock.json`
- Telegram plugin config schema: `/paperclip/.paperclip/plugins/node_modules/paperclip-plugin-telegram/dist/manifest.js`
- Runtime config baseline: `/paperclip/instances/default/config.json`

## Required Configuration
Set Telegram plugin instance config values in Paperclip board UI (Settings -> Plugins -> Telegram Bot):
- Required:
  - `telegramBotTokenRef` (Paperclip secret UUID; not raw token)
  - `defaultChatId`
- Strongly recommended for operations:
  - `enableCommands=true`
  - `enableInbound=true`
  - `paperclipBaseUrl=http://76.13.179.86:3100`

Optional but recommended:
- `approvalsChatId`
- `errorsChatId`
- `topicRouting=true` for forum topics
- `escalationChatId` and escalation timeout/action fields

## Dependency Wiring (Completed)
ACP companion plugin is now installed in runtime plugin dependencies:
- `paperclip-plugin-acp@^0.2.3`
- `paperclip-plugin-telegram@^0.2.3`

Verification commands:
```bash
cat /paperclip/.paperclip/plugins/package.json
ls -la /paperclip/.paperclip/plugins/node_modules | grep paperclip-plugin
node -e "import('/paperclip/.paperclip/plugins/node_modules/paperclip-plugin-telegram/dist/manifest.js').then(m=>console.log(m.default.id))"
node -e "import('/paperclip/.paperclip/plugins/node_modules/paperclip-plugin-acp/dist/manifest.js').then(m=>console.log(m.default.id))"
```

## End-to-End Validation
Board-level permissions are required for plugin activation checks.

1. Confirm plugins are enabled in Paperclip plugin manager:
- `paperclip-plugin-telegram`
- `paperclip-plugin-acp`

2. Configure Telegram plugin with required fields (`telegramBotTokenRef`, `defaultChatId`), then restart/reload plugin if prompted.

3. In Telegram chat connected to company:
- Run `/acp spawn backend-architect`
- Send a prompt in same topic/thread
- Confirm agent response appears in Telegram
- Reply to agent output and confirm follow-up response

4. Validate session control commands:
- `/acp status`
- `/acp cancel`
- `/acp close`

5. Confirm inbound/outbound routing:
- Telegram message creates/continues corresponding Paperclip issue/session comments
- Agent output remains thread-bound and ordered

## Failure Modes
- `Board access required` on `/api/plugins`:
  - Cause: non-board token; expected for regular agent identities.
  - Action: board user performs activation/config checks.

- Bot does not respond to `/acp` commands:
  - Verify `enableCommands=true`
  - Verify bot is in target chat and allowed to read messages (privacy settings/group setup)
  - Verify `telegramBotTokenRef` points to valid secret UUID

- `/acp spawn` works but no output:
  - Verify `paperclip-plugin-acp` enabled
  - Check plugin logs for `acp-spawn`/`plugin.paperclip-plugin-acp.output` flow
  - Confirm target agent name matches an existing Paperclip agent

- Inbound replies not mapped to issue/session:
  - Verify `enableInbound=true`
  - Ensure replies are in same thread/topic as the bot message

## Rollback
If Telegram/ACP behavior becomes unstable:
1. Disable Telegram plugin in Paperclip board UI.
2. Keep ACP plugin enabled only if used by another integration; otherwise disable ACP plugin.
3. Remove plugin dependency if required:
```bash
cd /paperclip/.paperclip/plugins
npm uninstall paperclip-plugin-acp
```
4. Re-enable previously stable plugin set and re-test `/status` and `/issues` commands.

## Security Notes
- Never store raw Telegram bot token in config fields; use secret reference UUID.
- Restrict who can edit plugin settings/secrets at board level.
- Keep `paperclipBaseUrl` pinned to trusted internal URL.
