#!/bin/zsh

SHELLCRAFT_BUFFER_FILE="/tmp/shellcraft_buffer.json"
SHELLCRAFT_EXEC_FILE="/tmp/shellcraft_exec.json"

_shellcraft_explain() {
  local buffer="$BUFFER"
  local cmd="${buffer%% *}"

  if [[ ${#buffer} -lt 2 ]]; then
    return
  fi

  local escaped="${buffer//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  echo "{\"type\":\"buffer\",\"buffer\":\"${escaped}\"}" >| "$SHELLCRAFT_BUFFER_FILE" &!
}

_shellcraft_clear() {
  echo '{"type":"buffer","buffer":""}' >| "$SHELLCRAFT_BUFFER_FILE" &!
}

_shellcraft_accept_line() {
  local buffer="$BUFFER"
  if [[ -n "$buffer" ]]; then
    local escaped="${buffer//\\/\\\\}"
    escaped="${escaped//\"/\\\"}"
    printf '{"type":"execute","buffer":"%s","exit_code":0}\n' "$escaped" >| "$SHELLCRAFT_EXEC_FILE"
  fi
  zle .accept-line
}

_shellcraft_self_insert() {
  zle .self-insert
  _shellcraft_explain
}

_shellcraft_backward_delete() {
  zle .backward-delete-char
  if [[ ${#BUFFER} -lt 2 ]]; then
    _shellcraft_clear
  else
    _shellcraft_explain
  fi
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
  :
}
zle -N zle-line-pre-redraw