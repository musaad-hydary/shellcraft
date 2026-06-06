#!/bin/zsh

SHELLCRAFT_PIPE="/tmp/shellcraft.pipe"
SHELLCRAFT_EXEC_FILE="/tmp/shellcraft_exec.json"

[[ -p "$SHELLCRAFT_PIPE" ]] || mkfifo "$SHELLCRAFT_PIPE"

_shellcraft_send() {
  echo "$1" > "$SHELLCRAFT_PIPE" &!
}

_shellcraft_explain() {
  local buffer="$BUFFER"
  local cmd="${buffer%% *}"

  if [[ -z "$buffer" ]]; then
    _shellcraft_send '{"type":"buffer","buffer":""}'
    return
  fi

  if [[ "$buffer" != *" "* ]] && [[ ${#cmd} -lt 2 ]]; then
    return
  fi

  local escaped="${buffer//\"/\\\"}"
  _shellcraft_send "{\"type\":\"buffer\",\"buffer\":\"${escaped}\"}"
}

_shellcraft_accept_line() {
  local buffer="$BUFFER"
  if [[ -n "$buffer" ]]; then
    local escaped="${buffer//\\/\\\\}"
    escaped="${escaped//\"/\\\"}"
    echo "{\"type\":\"execute\",\"buffer\":\"${escaped}\",\"exit_code\":0}" >| /tmp/shellcraft_exec.json
  fi
  zle .accept-line
}

_shellcraft_self_insert() {
  zle .self-insert
  _shellcraft_explain
}

_shellcraft_backward_delete() {
  zle .backward-delete-char
  _shellcraft_explain
}

_shellcraft_paste() {
  zle .bracketed-paste
  _shellcraft_explain
}

_shellcraft_yank() {
  zle .yank
  _shellcraft_explain
}

_shellcraft_yank_pop() {
  zle .yank-pop
  _shellcraft_explain
}

zle -N self-insert _shellcraft_self_insert
zle -N backward-delete-char _shellcraft_backward_delete
zle -N accept-line _shellcraft_accept_line
zle -N bracketed-paste _shellcraft_paste
zle -N yank _shellcraft_yank
zle -N yank-pop _shellcraft_yank_pop

zle-line-pre-redraw() {
  _shellcraft_explain
}
zle -N zle-line-pre-redraw