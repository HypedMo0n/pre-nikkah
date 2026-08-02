#!/bin/bash
#
# Local fork of the upstream mattpocock/skills hook.
#
# Upstream matched literal substrings such as "git push" and "git clean -fd".
# Both are ordinary CLI forms away from that exact spelling, so the hook waved
# them through while still reporting itself as protection:
#
#   git -C /some/repo push     global options are documented before the
#                              subcommand, so "git push" never appears
#   git clean -df              -d and -f are independent flags, in any order
#   git   push                 repeated whitespace
#
# This version tokenizes instead: it walks past git's global options to find
# the real subcommand, expands bundled short flags, and decides on the result.
# The original literal patterns still run afterwards as a backstop, so nothing
# that used to be blocked can become allowed by a parsing mistake here.

# Globbing off for the whole script. Word-splitting an argument list is
# unavoidable here, and with globbing on a bare `*` operand expands against the
# working directory before it can be compared -- so `git restore "*"`, which
# reaches git as a pathspec matching every tracked file, was never matched.
set -f

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

[ -z "$COMMAND" ] && exit 0

block() {
  echo "BLOCKED: '$COMMAND' is a destructive git command ($1). The user has prevented you from doing this." >&2
  exit 2
}

# Global options that consume the following token, so the subcommand is not
# the next one along. `git -h` documents these before the subcommand.
takes_value() {
  case "$1" in
    -C|-c|--git-dir|--work-tree|--namespace|--exec-path|--config-env) return 0 ;;
    *) return 1 ;;
  esac
}

# Split on shell separators so each command in a chain is judged on its own.
normalized=$(printf '%s' "$COMMAND" | tr '\n;|&' '    ')
read -r -a tokens <<< "$normalized"

# The shell removes quotes before git sees an argument, so `git checkout "."`
# reaches git as the same whole-tree pathspec as `git checkout .`. Comparing
# against the raw token left the quoted spellings unmatched and allowed.
for index in "${!tokens[@]}"; do
  token=${tokens[$index]}
  if [ ${#token} -ge 2 ]; then
    case "$token" in
      \"*\") token=${token:1:${#token}-2} ;;
      \'*\') token=${token:1:${#token}-2} ;;
    esac
  fi
  tokens[$index]=$token
done

count=${#tokens[@]}
index=0
while [ "$index" -lt "$count" ]; do
  token=${tokens[$index]}
  index=$((index + 1))

  # Accept `git`, `/usr/bin/git`, and `git.exe`.
  case "${token##*/}" in
    git|git.exe) ;;
    *) continue ;;
  esac

  # Walk past the global options to the subcommand.
  subcommand=""
  while [ "$index" -lt "$count" ]; do
    candidate=${tokens[$index]}
    index=$((index + 1))
    if takes_value "$candidate"; then
      index=$((index + 1))
      continue
    fi
    case "$candidate" in
      -*) continue ;;
      *) subcommand=$candidate; break ;;
    esac
  done
  [ -z "$subcommand" ] && continue

  # Collect this subcommand's arguments, stopping at the next git invocation.
  flags=""
  operands=""
  scan=$index
  while [ "$scan" -lt "$count" ]; do
    argument=${tokens[$scan]}
    case "${argument##*/}" in
      git|git.exe) break ;;
    esac
    case "$argument" in
      --*) flags="$flags ${argument%%=*}" ;;
      # Bundled short flags: -df is -d and -f. Expanded one character at a
      # time so grouping and order stop mattering.
      -?*)
        rest=${argument#-}
        while [ -n "$rest" ]; do
          flags="$flags -${rest:0:1}"
          rest=${rest:1}
        done
        ;;
      *) operands="$operands $argument" ;;
    esac
    scan=$((scan + 1))
  done

  has_flag() {
    case " $flags " in *" $1 "*) return 0 ;; *) return 1 ;; esac
  }
  has_operand() {
    case " $operands " in *" $1 "*) return 0 ;; *) return 1 ;; esac
  }

  case "$subcommand" in
    push)
      block "push" ;;
    reset)
      has_flag --hard && block "reset --hard" ;;
    clean)
      { has_flag -f || has_flag --force; } && block "clean --force" ;;
    branch)
      # -D is shorthand for --delete --force. The flags are also accepted
      # separately and in any grouping, so -d -f and -df delete an unmerged
      # branch just as -D does; matching only -D and the long pair left those
      # spellings allowed.
      has_flag -D && block "branch -D"
      { has_flag -d || has_flag --delete; } &&
        { has_flag -f || has_flag --force; } &&
        block "branch --delete --force" ;;
    checkout|switch|restore)
      # `git checkout -h` documents -f/--force as "throw away local
      # modifications", and `git switch -h` gives -f and --discard-changes the
      # same meaning. Switching refs that way erases uncommitted work just as
      # surely as a hard reset, and `switch` was not being examined at all.
      { has_flag -f || has_flag --force || has_flag --discard-changes; } &&
        block "$subcommand --force discards local modifications"

      # `.` is only one spelling of "the whole tree". Git's magic root
      # pathspec `:/` restores every tracked file from the repository root,
      # from any subdirectory, and a bare `*` matches everything too. Matching
      # the literal dot alone left those discarding the working tree unblocked.
      for operand in $operands; do
        case "$operand" in
          .|./|'*'|:/|:/.|:/'*'|':(top)'|':(top).')
            block "$subcommand over the whole tree ($operand)" ;;
        esac
      done ;;
  esac
done

# Backstop: the upstream literal patterns, unchanged.
DANGEROUS_PATTERNS=(
  "git push"
  "git reset --hard"
  "git clean -fd"
  "git clean -f"
  "git branch -D"
  "git checkout \."
  "git restore \."
  "push --force"
  "reset --hard"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'. The user has prevented you from doing this." >&2
    exit 2
  fi
done

exit 0
