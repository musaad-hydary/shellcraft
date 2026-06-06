import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  BookOpen,
  Clock,
  Skull,
  Sword,
  Terminal,
  Flag,
  Hash,
  Lightbulb,
  Fire,
} from "pixelarticons/react";

const COMMANDS: Record<
  string,
  {
    description: string;
    tip: string;
    flags: Record<string, string>;
    common: string[];
  }
> = {
  find: {
    description: "search for files and directories recursively",
    tip: "use -maxdepth to limit depth",
    common: ["-name", "-type", "-not", "-path"],
    flags: {
      "-name": "filter by filename or pattern",
      "-type": "filter by type: f=file d=directory",
      "-not": "invert the next condition",
      "-path": "filter by full path pattern",
      "-exec": "run a command on each result",
      "-maxdepth": "limit how deep to search",
    },
  },
  git: {
    description: "version control system",
    tip: "always pull before you push",
    common: ["log", "status", "push", "pull"],
    flags: {
      log: "show commit history",
      status: "show working tree status",
      push: "upload commits to remote",
      pull: "fetch and merge remote changes",
      "--oneline": "one commit per line",
      "--graph": "show ascii branch graph",
      "--force": "overwrite remote — rewrites history",
      "-i": "interactive mode",
      rebase: "reapply commits on top of another branch",
      diff: "show changes between commits",
    },
  },
  ls: {
    description: "list directory contents",
    tip: "use -la to see all files with permissions",
    common: ["-la", "-l", "-a", "-h"],
    flags: {
      "-l": "long format with permissions and sizes",
      "-a": "show hidden files starting with .",
      "-h": "human readable file sizes",
      "-t": "sort by modification time",
      "-r": "reverse sort order",
    },
  },
  grep: {
    description: "search for text patterns inside files",
    tip: "pipe other commands into grep to filter output",
    common: ["-r", "-i", "-n", "-v"],
    flags: {
      "-r": "search recursively through directories",
      "-i": "case insensitive search",
      "-n": "show line numbers in results",
      "-v": "invert match — show non-matching lines",
      "-l": "only show filenames that match",
      "--include": "only search files matching a pattern",
    },
  },
  rm: {
    description: "delete files or directories",
    tip: "no undo — move to trash if unsure",
    common: ["-r", "-f"],
    flags: {
      "-r": "remove directories recursively",
      "-f": "force removal without prompting",
      "-rf": "force recursive removal — permanently deletes everything",
    },
  },
  cd: {
    description: "change the current working directory",
    tip: "use cd - to jump back to previous directory",
    common: ["..", "~", "-"],
    flags: {
      "..": "go up one directory",
      "~": "go to home directory",
      "-": "go to previous directory",
    },
  },
  npm: {
    description: "node package manager",
    tip: "use npm ci in CI environments",
    common: ["install", "run", "build", "dev"],
    flags: {
      install: "install all dependencies",
      run: "run a script from package.json",
      build: "run the build script",
      dev: "run the development server",
      "-g": "install package globally",
      "--save-dev": "save as a dev dependency",
    },
  },
  curl: {
    description: "transfer data to or from a server",
    tip: "add -s to silence progress when piping",
    common: ["-X", "-H", "-d", "-s"],
    flags: {
      "-X": "specify the HTTP method",
      "-H": "add a request header",
      "-d": "send data in the request body",
      "-o": "write output to a file",
      "-s": "silent mode — no progress bar",
      "-L": "follow redirects automatically",
    },
  },
  chmod: {
    description: "change who can read write or execute a file",
    tip: "use 644 for files and 755 for directories",
    common: ["-R", "644", "755", "777"],
    flags: {
      "-R": "apply recursively to all files in directory",
      "777": "full access for everyone — avoid in production",
      "644": "owner read/write, others read only",
      "755": "owner full access, others read and execute",
    },
  },
  ssh: {
    description: "connect securely to a remote machine",
    tip: "set up SSH keys to avoid typing passwords",
    common: ["-i", "-p"],
    flags: {
      "-i": "specify the identity file (private key)",
      "-p": "connect on a specific port",
      "-L": "local port forwarding",
    },
  },
  mkdir: {
    description: "create a new directory",
    tip: "use -p to create nested directories at once",
    common: ["-p"],
    flags: { "-p": "create parent directories as needed" },
  },
  cp: {
    description: "copy files or directories",
    tip: "use -r to copy entire directories",
    common: ["-r", "-p"],
    flags: {
      "-r": "copy directories recursively",
      "-p": "preserve file attributes",
      "-i": "prompt before overwriting",
    },
  },
  mv: {
    description: "move or rename files and directories",
    tip: "mv is also how you rename files",
    common: ["-i"],
    flags: {
      "-i": "prompt before overwriting",
      "-n": "do not overwrite existing files",
    },
  },
  cat: {
    description: "print file contents to the terminal",
    tip: "pipe into less for large files",
    common: ["-n"],
    flags: { "-n": "show line numbers", "-A": "show special characters" },
  },
  kill: {
    description: "send a signal to stop a process",
    tip: "try without -9 first for graceful shutdown",
    common: ["-9", "-15"],
    flags: {
      "-9": "force kill — no chance to clean up",
      "-15": "graceful termination (default)",
    },
  },
  sudo: {
    description: "run a command as administrator",
    tip: "avoid using sudo unless necessary",
    common: [],
    flags: {
      "-i": "start a root shell session",
      "-u": "run as a specific user",
    },
  },
  brew: {
    description: "macOS package manager",
    tip: "run brew update before brew upgrade",
    common: ["install", "update", "upgrade", "list"],
    flags: {
      install: "install a package",
      uninstall: "remove a package",
      update: "fetch latest package info",
      upgrade: "upgrade installed packages",
      list: "show installed packages",
    },
  },
  docker: {
    description: "build and run containerized applications",
    tip: "use docker-compose for multi-container setups",
    common: ["run", "build", "ps", "stop"],
    flags: {
      run: "run a container from an image",
      build: "build an image from a Dockerfile",
      ps: "list running containers",
      stop: "stop a running container",
      pull: "download an image",
    },
  },
  clear: {
    description: "clear the terminal screen",
    tip: "cmd+k does the same thing on mac",
    common: [],
    flags: {},
  },
  echo: {
    description: "print text or variable values",
    tip: "use echo $VARIABLE to inspect env vars",
    common: [],
    flags: { "-n": "no trailing newline", "-e": "enable backslash escapes" },
  },
  pwd: {
    description: "print the current working directory",
    tip: "useful in scripts to know where you are",
    common: [],
    flags: {},
  },
  which: {
    description: "show the full path to a command",
    tip: "use which python3 to check which version",
    common: [],
    flags: {},
  },
  touch: {
    description: "create an empty file or update its timestamp",
    tip: "touch multiple files at once with spaces",
    common: [],
    flags: {},
  },
  exit: {
    description: "close the current shell session",
    tip: "or just press ctrl+d",
    common: [],
    flags: {},
  },
  history: {
    description: "show previously run commands",
    tip: "use ctrl+r to search history interactively",
    common: [],
    flags: {},
  },
  export: {
    description: "set an environment variable",
    tip: "add to .zshrc to make it permanent",
    common: [],
    flags: {},
  },
  source: {
    description: "run a script in the current shell session",
    tip: "env changes persist after sourcing",
    common: [],
    flags: {},
  },
  open: {
    description: "open a file or URL with the default app",
    tip: "use open . to open current directory in Finder",
    common: ["-a"],
    flags: { "-a": "specify which application to use" },
  },
  vim: {
    description: "powerful terminal text editor",
    tip: "type :q! to quit without saving",
    common: [],
    flags: {},
  },
  nano: {
    description: "simple terminal text editor",
    tip: "ctrl+x to exit, ctrl+o to save",
    common: [],
    flags: {},
  },
  tmux: {
    description: "split and manage terminal sessions",
    tip: "the prefix key is ctrl+b by default",
    common: ["new", "attach", "ls"],
    flags: {
      new: "create a new session",
      attach: "attach to existing session",
      ls: "list all sessions",
    },
  },
  python3: {
    description: "run python 3 scripts",
    tip: "use -m venv for virtual environments",
    common: ["-m", "-c"],
    flags: {
      "-m": "run a module as a script",
      "-c": "run a string as python code",
    },
  },
  node: {
    description: "run javascript outside the browser",
    tip: "use node -e to run a quick snippet",
    common: ["-e"],
    flags: { "-e": "run a string as javascript code" },
  },
  cargo: {
    description: "rust package manager and build tool",
    tip: "use cargo new to scaffold a project",
    common: ["build", "run", "test", "new"],
    flags: {
      build: "compile the project",
      run: "compile and run",
      test: "run tests",
      new: "create a new project",
    },
  },
  sed: {
    description: "find and replace text in files or streams",
    tip: "use sed -i to edit files in place",
    common: ["-i", "-e"],
    flags: {
      "-i": "edit file in place",
      "-n": "suppress default output",
      "-e": "add a script expression",
    },
  },
  awk: {
    description: "pattern scanning and text processing",
    tip: "use awk to extract specific columns",
    common: ["-F"],
    flags: { "-F": "set field separator", "-v": "set a variable" },
  },
  tar: {
    description: "create or extract file archives",
    tip: "use -xzf to extract a .tar.gz file",
    common: ["-xzf", "-czf"],
    flags: {
      "-c": "create a new archive",
      "-x": "extract files from archive",
      "-z": "compress with gzip",
      "-f": "specify filename",
      "-v": "verbose output",
    },
  },
  ping: {
    description: "check if a network host is reachable",
    tip: "press ctrl+c to stop sending packets",
    common: ["-c"],
    flags: { "-c": "number of packets to send" },
  },
  ps: {
    description: "list currently running processes",
    tip: "pipe into grep to find a specific process",
    common: ["aux"],
    flags: { aux: "show all processes with full details" },
  },
  df: {
    description: "show disk space usage for file systems",
    tip: "use df -h for human readable sizes",
    common: ["-h"],
    flags: { "-h": "human readable sizes" },
  },
  du: {
    description: "show how much disk space files and folders use",
    tip: "use du -sh * for a quick summary",
    common: ["-sh"],
    flags: { "-s": "display only a total", "-h": "human readable sizes" },
  },
  whoami: {
    description: "print the current logged-in username",
    tip: "useful in scripts to check who is running them",
    common: [],
    flags: {},
  },
  xargs: {
    description: "build and run commands from standard input",
    tip: "use with find to run commands on many files",
    common: ["-I"],
    flags: {
      "-I": "replace string with input",
      "-n": "max args per command",
      "-P": "run in parallel",
    },
  },
  wc: {
    description: "count lines words or characters in a file",
    tip: "pipe into wc -l to count lines of output",
    common: ["-l", "-w"],
    flags: {
      "-l": "count lines only",
      "-w": "count words only",
      "-c": "count bytes only",
    },
  },
  head: {
    description: "show the first lines of a file",
    tip: "default is 10 lines",
    common: ["-n"],
    flags: { "-n": "specify how many lines to show" },
  },
  tail: {
    description: "show the last lines of a file",
    tip: "use tail -f to follow a file in real time",
    common: ["-n", "-f"],
    flags: {
      "-n": "specify how many lines to show",
      "-f": "follow the file as it grows",
    },
  },
  sort: {
    description: "sort lines of text files",
    tip: "use sort -u to remove duplicates while sorting",
    common: ["-r", "-n"],
    flags: {
      "-r": "reverse order",
      "-n": "sort numerically",
      "-u": "remove duplicates",
    },
  },
  uniq: {
    description: "filter out duplicate adjacent lines",
    tip: "sort first before using uniq",
    common: ["-c"],
    flags: {
      "-c": "prefix with count of occurrences",
      "-d": "only print duplicate lines",
      "-u": "only print unique lines",
    },
  },
};

const DANGEROUS = [
  "rm -rf",
  "rm -fr",
  "git push --force",
  "git push -f",
  "chmod 777",
  "kill -9",
  "dd ",
  "mkfs",
];

type TokenType = "command" | "flag" | "argument" | "pipe" | "redirect";
interface Token {
  value: string;
  type: TokenType;
}

function parseCommand(buffer: string): Token[] {
  if (!buffer.trim()) return [];
  const tokens: Token[] = [];
  const parts = buffer.trim().split(/\s+/);
  let isFirst = true;
  for (const part of parts) {
    if (part === "|" || part === "&&" || part === "||") {
      tokens.push({ value: part, type: "pipe" as TokenType });
      isFirst = true;
    } else if (part === ">" || part === ">>" || part === "<") {
      tokens.push({ value: part, type: "redirect" as TokenType });
    } else if (isFirst) {
      tokens.push({ value: part, type: "command" as TokenType });
      isFirst = false;
    } else if (part.startsWith("-")) {
      tokens.push({ value: part, type: "flag" as TokenType });
    } else {
      tokens.push({ value: part, type: "argument" as TokenType });
    }
  }
  return tokens;
}

function buildPipelineExplanation(buffer: string): string | null {
  const hasPipe = buffer.includes("|");
  const hasAnd = buffer.includes("&&");
  const hasSemi = buffer.includes(";");
  if (!hasPipe && !hasAnd && !hasSemi) return null;
  const segments = buffer
    .split(/\||&&|;/)
    .map((s) => s.trim())
    .filter(Boolean);
  const explanations = segments.map((seg) => {
    const cmd = seg.split(/\s+/)[0].toLowerCase();
    return COMMANDS[cmd]?.description || cmd;
  });
  if (hasPipe) return explanations.join(" → ");
  if (hasAnd) return explanations.join(", then if successful → ");
  return explanations.join(", then → ");
}

function buildFullExplanation(
  tokens: Token[],
  cmdData: (typeof COMMANDS)[string],
): string {
  const flagTokens = tokens.filter((t) => t.type === "flag");
  const argTokens = tokens.filter((t) => t.type === "argument");
  let parts: string[] = [cmdData.description];
  const flagExplanations = flagTokens
    .map((t) => cmdData.flags[t.value])
    .filter(Boolean);
  if (flagExplanations.length > 0) parts.push(flagExplanations.join(", "));
  if (argTokens.length > 0)
    parts.push(`targeting ${argTokens.map((t) => `"${t.value}"`).join(", ")}`);
  return parts.join(" — ");
}

const C = {
  bg: "rgb(44,44,46)",
  border: "rgba(80,80,80,0.8)",
  borderBright: "rgb(110,110,110)",
  cmd: "100,180,80",
  flag: "58,130,200",
  arg: "160,140,100",
  pipe: "120,110,90",
  text: "rgba(180,200,160,0.88)",
  muted: "rgba(140,130,110,0.55)",
  dim: "rgba(255,255,255,0.05)",
  green: "100,180,80",
  lapis: "58,130,200",
  gold: "180,150,40",
  red: "200,60,50",
};

const TNTIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 8 8"
    style={{ imageRendering: "pixelated", flexShrink: 0 }}
  >
    <rect x="0" y="0" width="8" height="8" fill="rgba(180,40,30,0.9)" />
    <rect x="1" y="1" width="2" height="2" fill="rgba(230,210,200,0.8)" />
    <rect x="5" y="1" width="2" height="2" fill="rgba(230,210,200,0.8)" />
    <rect x="1" y="5" width="2" height="2" fill="rgba(230,210,200,0.8)" />
    <rect x="5" y="5" width="2" height="2" fill="rgba(230,210,200,0.8)" />
    <rect x="3" y="3" width="2" height="2" fill="rgba(230,210,200,0.4)" />
  </svg>
);

const TOKEN_COLORS: Record<TokenType, string> = {
  command: C.cmd,
  flag: C.flag,
  argument: C.arg,
  pipe: C.pipe,
  redirect: C.pipe,
};

const TOKEN_ICONS: Record<TokenType, ReactElement> = {
  command: (
    <Terminal
      width={9}
      height={9}
      style={{ color: `rgba(${C.cmd},0.8)`, flexShrink: 0 }}
    />
  ),
  flag: (
    <Flag
      width={9}
      height={9}
      style={{ color: `rgba(${C.flag},0.8)`, flexShrink: 0 }}
    />
  ),
  argument: (
    <Hash
      width={9}
      height={9}
      style={{ color: `rgba(${C.arg},0.7)`, flexShrink: 0 }}
    />
  ),
  pipe: (
    <Hash
      width={9}
      height={9}
      style={{ color: `rgba(${C.pipe},0.5)`, flexShrink: 0 }}
    />
  ),
  redirect: (
    <Hash
      width={9}
      height={9}
      style={{ color: `rgba(${C.pipe},0.5)`, flexShrink: 0 }}
    />
  ),
};

interface ExecutePayload {
  buffer: string;
  exit_code: number;
  recent: string[];
}

export default function App() {
  const [buffer, setBuffer] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastExit, setLastExit] = useState<number | null>(null);

  useEffect(() => {
    const u1 = listen<string>("buffer-update", (e) => setBuffer(e.payload));
    const u2 = listen<ExecutePayload | string>("command-executed", (e) => {
      let cmd = "";
      let exit_code = 0;
      let updatedRecent: string[] = [];
      if (typeof e.payload === "string") {
        try {
          const parsed = JSON.parse(e.payload);
          cmd = parsed.buffer || "";
          exit_code = parsed.exit_code ?? 0;
          updatedRecent = parsed.recent || [];
        } catch {
          cmd = e.payload;
        }
      } else {
        cmd = e.payload.buffer || "";
        exit_code = e.payload.exit_code ?? 0;
        updatedRecent = e.payload.recent || [];
      }
      if (cmd) setLastExit(exit_code);
      if (updatedRecent.length > 0) setRecent(updatedRecent);
      setBuffer("");
    });
    const u3 = listen<string[]>("recent-loaded", (e) => {
      if (Array.isArray(e.payload) && e.payload.length > 0)
        setRecent(e.payload);
    });
    return () => {
      u1.then((f) => f());
      u2.then((f) => f());
      u3.then((f) => f());
    };
  }, []);

  const tokens = parseCommand(buffer);
  const cmdToken = tokens.find((t) => t.type === "command");
  const cmdData = cmdToken ? COMMANDS[cmdToken.value.toLowerCase()] : null;
  const dangerous = DANGEROUS.some((d) => buffer.toLowerCase().includes(d));
  const complexity = Math.min(tokens.length, 5);
  const pipelineExplanation = buildPipelineExplanation(buffer);
  const typedArgs = tokens
    .filter((t) => t.type === "flag" || t.type === "argument")
    .map((t) => t.value);
  const hasArgs = tokens.length > 1;
  const commonHints =
    cmdData?.common.filter((f) => !typedArgs.includes(f)).slice(0, 2) || [];
  const fullExplanation =
    cmdData && hasArgs ? buildFullExplanation(tokens, cmdData) : null;

  const handleCopy = (text: string) => {
    writeText(text)
      .then(() => {
        setCopied(text);
        setTimeout(() => setCopied(null), 1200);
      })
      .catch(() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(text);
            setTimeout(() => setCopied(null), 1200);
          })
          .catch(() => {});
      });
  };

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap"
      />
      <div
        style={{
          background: C.bg,
          border: `0.5px solid ${C.borderBright}`,
          borderTop: `0.5px solid rgb(160,160,160)`,
          width: "100%",
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'JetBrains Mono', monospace",
          scrollbarWidth: "none" as const,
        }}
      >
        {/* titlebar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            borderBottom: `0.5px solid rgb(60,60,62)`,
            background: "rgb(35,35,37)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: 2,
              background: `rgba(${C.green},0.75)`,
            }}
          />
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: 2,
              background: "rgba(255,255,255,0.07)",
              marginLeft: 2,
            }}
          />
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: 2,
              background: "rgba(255,255,255,0.07)",
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: C.muted,
              flex: 1,
              textAlign: "center",
              letterSpacing: ".14em",
              fontWeight: 500,
            }}
          >
            shellcraft
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {lastExit !== null && (
              <span
                style={{
                  fontSize: 9,
                  color:
                    lastExit === 0
                      ? `rgba(${C.green},0.7)`
                      : `rgba(${C.red},0.7)`,
                  letterSpacing: ".06em",
                }}
              >
                {lastExit === 0 ? "✓" : `✗ ${lastExit}`}
              </span>
            )}
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 1,
                    background:
                      i < complexity
                        ? dangerous
                          ? `rgba(${C.red},0.85)`
                          : `rgba(${C.green},0.75)`
                        : C.dim,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {!buffer.trim() ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: C.muted,
                textAlign: "center",
                lineHeight: 2,
              }}
            >
              start typing a command
              <br />
              in your terminal
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flex: 1,
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {/* left panel */}
            <div
              style={{
                flex: 1,
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 0,
                overflow: "hidden",
                scrollbarWidth: "none" as const,
              }}
            >
              {/* tokens + hints */}
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  flexShrink: 0,
                }}
              >
                {tokens.map((t, i) => {
                  const color = TOKEN_COLORS[t.type];
                  let desc: string = t.type;
                  if (t.type === "command" && cmdData)
                    desc = cmdData.description.slice(0, 22);
                  if (t.type === "flag" && cmdData)
                    desc = (cmdData.flags[t.value] || "flag").slice(0, 22);
                  return (
                    <div
                      key={i}
                      style={{
                        borderRadius: 4,
                        padding: "3px 6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        background: `rgba(${color},0.07)`,
                        border: `0.5px solid rgba(${color},0.22)`,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        {TOKEN_ICONS[t.type]}
                        <span
                          style={{
                            fontSize: 10,
                            color: `rgba(${color},0.9)`,
                            fontWeight: 500,
                          }}
                        >
                          {t.value}
                        </span>
                      </div>
                      <span style={{ fontSize: 8, color: C.muted }}>
                        {desc}
                      </span>
                    </div>
                  );
                })}
                {cmdData &&
                  !hasArgs &&
                  commonHints.map((hint) => (
                    <div
                      key={hint}
                      style={{
                        borderRadius: 4,
                        padding: "3px 6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        background: "rgba(255,255,255,0.03)",
                        border: `0.5px dashed rgba(255,255,255,0.15)`,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Flag
                          width={9}
                          height={9}
                          style={{
                            color: "rgba(255,255,255,0.28)",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.35)",
                            fontWeight: 400,
                          }}
                        >
                          {hint}
                        </span>
                      </div>
                      <span
                        style={{ fontSize: 8, color: "rgba(255,255,255,0.2)" }}
                      >
                        {cmdData.flags[hint] || "common flag"}
                      </span>
                    </div>
                  ))}
              </div>

              {/* explanation */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                {dangerous ? (
                  <div
                    style={{
                      background: `rgba(${C.red},0.07)`,
                      border: `0.5px solid rgba(${C.red},0.28)`,
                      borderRadius: 6,
                      padding: "7px 10px",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <TNTIcon />
                      <span
                        style={{
                          fontSize: 11,
                          color: `rgba(${C.red},0.9)`,
                          fontWeight: 600,
                        }}
                      >
                        tnt detected
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: `rgba(${C.red},0.6)`,
                        lineHeight: 1.5,
                        fontWeight: 300,
                      }}
                    >
                      destructive command — no undo, no respawn.
                    </div>
                  </div>
                ) : pipelineExplanation ? (
                  <div
                    style={{
                      background: `rgba(${C.lapis},0.06)`,
                      border: `0.5px solid rgba(${C.lapis},0.2)`,
                      borderRadius: 6,
                      padding: "7px 10px",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 8,
                        color: `rgba(${C.lapis},0.55)`,
                        letterSpacing: ".1em",
                        marginBottom: 4,
                        fontWeight: 500,
                      }}
                    >
                      <Hash
                        width={10}
                        height={10}
                        style={{ color: `rgba(${C.lapis},0.6)` }}
                      />
                      pipeline
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.text,
                        lineHeight: 1.5,
                        fontWeight: 300,
                      }}
                    >
                      {pipelineExplanation}
                    </div>
                  </div>
                ) : fullExplanation ? (
                  <>
                    <div
                      style={{
                        background: `rgba(${C.gold},0.06)`,
                        border: `0.5px solid rgba(${C.gold},0.2)`,
                        borderRadius: 6,
                        padding: "7px 10px",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 8,
                          color: `rgba(${C.gold},0.55)`,
                          letterSpacing: ".1em",
                          marginBottom: 4,
                          fontWeight: 500,
                        }}
                      >
                        <BookOpen
                          width={10}
                          height={10}
                          style={{ color: `rgba(${C.gold},0.6)` }}
                        />
                        book and quill
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: C.text,
                          lineHeight: 1.5,
                          fontWeight: 300,
                        }}
                      >
                        {fullExplanation}
                      </div>
                    </div>
                    {cmdData && (
                      <div
                        style={{
                          background: `rgba(${C.green},0.06)`,
                          border: `0.5px solid rgba(${C.green},0.2)`,
                          borderRadius: 6,
                          padding: "6px 10px",
                          display: "flex",
                          gap: 6,
                          alignItems: "flex-start",
                          flexShrink: 0,
                        }}
                      >
                        <Lightbulb
                          width={10}
                          height={10}
                          style={{
                            color: `rgba(${C.green},0.6)`,
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        />
                        <div
                          style={{
                            fontSize: 9,
                            color: `rgba(${C.green},0.75)`,
                            lineHeight: 1.5,
                            fontWeight: 300,
                          }}
                        >
                          {cmdData.tip}
                        </div>
                      </div>
                    )}
                  </>
                ) : !cmdData ? (
                  <div
                    style={{
                      background: C.dim,
                      border: `0.5px solid ${C.border}`,
                      borderRadius: 6,
                      padding: "7px 10px",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        marginBottom: 3,
                      }}
                    >
                      <Skull
                        width={10}
                        height={10}
                        style={{ color: C.muted }}
                      />
                      <span
                        style={{
                          fontSize: 8,
                          color: C.muted,
                          letterSpacing: ".1em",
                        }}
                      >
                        unknown command
                      </span>
                    </div>
                    <div
                      style={{ fontSize: 9, color: C.muted, lineHeight: 1.5 }}
                    >
                      not in the crafting table yet
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* divider */}
            <div
              style={{
                width: "0.5px",
                background: "rgb(60,60,62)",
                flexShrink: 0,
              }}
            />

            {/* right panel */}
            <div
              style={{
                width: 110,
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flexShrink: 0,
                overflow: "hidden",
                scrollbarWidth: "none" as const,
              }}
            >
              {/* recently used */}
              <div style={{ flexShrink: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginBottom: 6,
                  }}
                >
                  <Clock width={10} height={10} style={{ color: C.muted }} />
                  <span
                    style={{
                      fontSize: 8,
                      color: C.muted,
                      letterSpacing: ".08em",
                    }}
                  >
                    recently used
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 3,
                  }}
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <div
                      key={i}
                      onClick={() => recent[i] && handleCopy(recent[i])}
                      title={recent[i] ? `copy: ${recent[i]}` : undefined}
                      style={{
                        height: 28,
                        background: recent[i]
                          ? copied === recent[i]
                            ? `rgba(${C.green},0.15)`
                            : `rgba(${C.gold},0.08)`
                          : C.dim,
                        border: `0.5px solid ${recent[i] ? (copied === recent[i] ? `rgba(${C.green},0.4)` : `rgba(${C.gold},0.22)`) : C.border}`,
                        borderRadius: 3,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: recent[i] ? "pointer" : "default",
                        transition: "all 0.15s ease",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 7,
                          color: recent[i]
                            ? copied === recent[i]
                              ? `rgba(${C.green},0.9)`
                              : `rgba(${C.gold},0.8)`
                            : "rgba(255,255,255,0.08)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          padding: "0 2px",
                        }}
                      >
                        {copied === recent[i]
                          ? "✓"
                          : recent[i]?.split(" ")[0] || ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* flags */}
              {cmdData && Object.keys(cmdData.flags).length > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 5,
                    }}
                  >
                    <Sword width={10} height={10} style={{ color: C.muted }} />
                    <span
                      style={{
                        fontSize: 8,
                        color: C.muted,
                        letterSpacing: ".08em",
                      }}
                    >
                      flags
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 3 }}
                  >
                    {Object.entries(cmdData.flags)
                      .slice(0, 3)
                      .map(([flag, desc]) => (
                        <div key={flag}>
                          <span
                            style={{
                              fontSize: 8,
                              color: `rgba(${C.lapis},0.8)`,
                              fontWeight: 500,
                              display: "block",
                            }}
                          >
                            {flag}
                          </span>
                          <span
                            style={{
                              fontSize: 7,
                              color: C.muted,
                              fontWeight: 300,
                              display: "block",
                            }}
                          >
                            {desc.slice(0, 28)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {dangerous && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  <Fire
                    width={10}
                    height={10}
                    style={{ color: `rgba(${C.red},0.7)` }}
                  />
                  <span style={{ fontSize: 8, color: `rgba(${C.red},0.6)` }}>
                    dangerous
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
