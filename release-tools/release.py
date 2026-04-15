#!/usr/bin/env python3
"""
Cyb3rWrld Checkers - Release Manager GUI
Run: python release-tools/release.py
Or double-click release-tools/release.py (if Python is associated)
"""

import json
import os
import subprocess
import sys
import threading
import tkinter as tk
import urllib.error
import urllib.request
from tkinter import font, messagebox, ttk

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SUGGESTIONS = [
    "Update checker piece colors",
    "Fix game logic bug",
    "Improve performance",
    "Add new feature",
    "Update documentation",
    "Refactor code",
    "Fix memory leak",
    "Optimize rendering",
    "Update dependencies",
    "Fix UI styling",
    "Improve board visuals",
    "Fix multiplayer sync",
]

DARK_BG = "#070b18"
PANEL_BG = "#0d1227"
ACCENT = "#ff7a1a"
ACCENT_DARK = "#ff4d00"
VIOLET = "#8b5cf6"
BLUE = "#2f7bff"
TEXT = "#edf3ff"
MUTED = "#97a9d3"
SUCCESS = "#10b981"
ERROR = "#ef4444"
BORDER = "#1e2a55"


def get_version():
    try:
        pkg = os.path.join(PROJECT_ROOT, "package.json")
        with open(pkg, encoding="utf-8") as f:
            return json.load(f).get("version", "unknown")
    except Exception:
        return "unknown"


def check_tools():
    missing = []
    for tool in ("git", "npm", "gh"):
        result = subprocess.run(
            f"where {tool}", shell=True, capture_output=True, text=True
        )
        if result.returncode != 0:
            missing.append(tool)
    return missing


class ReleaseApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("🚀 Cyb3rWrld Checkers — Release Manager")
        self.configure(bg=DARK_BG)
        self.resizable(False, False)
        self.geometry("620x680")

        self._running = False
        self._suggesting = False
        self._suggestion_visible = False
        self.dynamic_suggestions = []

        self._build_ui()
        self._load_version()

    # ── UI Construction ──────────────────────────────────────────────────────

    def _build_ui(self):
        mono = font.Font(family="Consolas", size=9)
        heading = font.Font(family="Segoe UI", size=18, weight="bold")
        sub = font.Font(family="Segoe UI", size=10)
        label_font = font.Font(family="Segoe UI", size=9, weight="bold")

        # Header
        header = tk.Frame(self, bg=DARK_BG, pady=18)
        header.pack(fill="x", padx=24)

        tk.Label(
            header,
            text="🚀  Cyb3rWrld Checkers",
            font=heading,
            bg=DARK_BG,
            fg=TEXT,
        ).pack(anchor="w")

        self.version_label = tk.Label(
            header, text="v…", font=sub, bg=DARK_BG, fg=MUTED
        )
        self.version_label.pack(anchor="w")

        # Divider
        tk.Frame(self, bg=BORDER, height=1).pack(fill="x", padx=24)

        # Body
        body = tk.Frame(self, bg=DARK_BG, pady=16)
        body.pack(fill="both", padx=24)

        # Commit message label
        tk.Label(body, text="COMMIT MESSAGE", font=label_font, bg=DARK_BG, fg=MUTED).pack(anchor="w", pady=(0, 6))

        # Input wrapper (for the dropdown to sit on top of)
        input_frame = tk.Frame(body, bg=DARK_BG)
        input_frame.pack(fill="x")

        self.commit_var = tk.StringVar()
        self.commit_var.trace_add("write", self._on_commit_change)

        self.commit_entry = tk.Entry(
            input_frame,
            textvariable=self.commit_var,
            font=font.Font(family="Segoe UI", size=11),
            bg=PANEL_BG,
            fg=TEXT,
            insertbackground=ACCENT,
            relief="flat",
            bd=0,
            highlightthickness=2,
            highlightbackground=BORDER,
            highlightcolor=ACCENT,
        )
        self.commit_entry.pack(fill="x", ipady=10)
        self.commit_entry.bind("<FocusOut>", lambda e: self.after(150, self._hide_suggestions))
        self.commit_entry.bind("<Return>", lambda e: self._hide_suggestions())
        self.commit_entry.bind("<Escape>", lambda e: self._hide_suggestions())
        self.commit_entry.bind("<Down>", self._focus_suggestions)

        self.ai_btn = tk.Button(
            body,
            text="AI Suggest Commit",
            font=font.Font(family="Segoe UI", size=10, weight="bold"),
            bg=PANEL_BG,
            fg=TEXT,
            activebackground="#1a254d",
            activeforeground=TEXT,
            relief="flat",
            bd=0,
            cursor="hand2",
            pady=8,
            command=self._start_ai_suggest,
        )
        self.ai_btn.pack(fill="x", pady=(10, 0))

        # Suggestions dropdown (floating listbox)
        self.suggestion_frame = tk.Frame(self, bg=PANEL_BG, bd=1, relief="flat", highlightthickness=1, highlightbackground=BORDER)
        self.suggestion_list = tk.Listbox(
            self.suggestion_frame,
            font=font.Font(family="Segoe UI", size=10),
            bg=PANEL_BG,
            fg=TEXT,
            selectbackground=ACCENT,
            selectforeground="#fff8ef",
            relief="flat",
            bd=0,
            activestyle="none",
            highlightthickness=0,
            cursor="hand2",
        )
        self.suggestion_list.pack(fill="both", expand=True)
        self.suggestion_list.bind("<ButtonRelease-1>", self._select_suggestion)
        self.suggestion_list.bind("<Return>", self._select_suggestion)
        self.suggestion_list.bind("<Escape>", lambda e: self._hide_suggestions())

        # Release button
        self.release_btn = tk.Button(
            body,
            text="🚀  Start Release",
            font=font.Font(family="Segoe UI", size=11, weight="bold"),
            bg=ACCENT,
            fg="#fff8ef",
            activebackground=ACCENT_DARK,
            activeforeground="#fff8ef",
            relief="flat",
            bd=0,
            cursor="hand2",
            pady=12,
            command=self._start_release,
        )
        self.release_btn.pack(fill="x", pady=(16, 0))

        # Status bar
        self.status_var = tk.StringVar(value="Ready.")
        status_bar = tk.Label(
            body,
            textvariable=self.status_var,
            font=font.Font(family="Segoe UI", size=9),
            bg=DARK_BG,
            fg=MUTED,
            anchor="w",
        )
        status_bar.pack(fill="x", pady=(8, 0))

        # Log area
        tk.Label(body, text="RELEASE LOG", font=label_font, bg=DARK_BG, fg=MUTED).pack(anchor="w", pady=(16, 6))

        log_container = tk.Frame(body, bg=PANEL_BG, highlightthickness=1, highlightbackground=BORDER)
        log_container.pack(fill="both", expand=True)

        scrollbar = tk.Scrollbar(log_container, bg=PANEL_BG, troughcolor=DARK_BG, relief="flat", bd=0)
        scrollbar.pack(side="right", fill="y")

        self.log = tk.Text(
            log_container,
            font=mono,
            bg=PANEL_BG,
            fg="#b4a9ff",
            insertbackground=ACCENT,
            relief="flat",
            bd=0,
            state="disabled",
            height=14,
            padx=10,
            pady=8,
            wrap="word",
            yscrollcommand=scrollbar.set,
        )
        self.log.pack(fill="both", expand=True)
        scrollbar.config(command=self.log.yview)

        # Tag colours for log
        self.log.tag_config("ok",      foreground=SUCCESS)
        self.log.tag_config("err",     foreground=ERROR)
        self.log.tag_config("step",    foreground=ACCENT)
        self.log.tag_config("muted",   foreground=MUTED)
        self.log.tag_config("version", foreground=VIOLET)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _load_version(self):
        v = get_version()
        self.version_label.config(text=f"v{v}")

    def _log(self, text, tag=""):
        self.log.config(state="normal")
        self.log.insert("end", text + "\n", tag)
        self.log.see("end")
        self.log.config(state="disabled")

    def _clear_log(self):
        self.log.config(state="normal")
        self.log.delete("1.0", "end")
        self.log.config(state="disabled")

    def _set_status(self, text, color=MUTED):
        self.status_var.set(text)
        # find the status label and recolor
        for widget in self.winfo_children():
            pass  # traversed in _build_ui via pack — update via tag trick
        self.update_idletasks()

    # ── Autocomplete ──────────────────────────────────────────────────────────

    def _on_commit_change(self, *_):
        query = self.commit_var.get().lower()
        if not query:
            self._hide_suggestions()
            return
        all_suggestions = self.dynamic_suggestions + [s for s in SUGGESTIONS if s not in self.dynamic_suggestions]
        matches = [s for s in all_suggestions if query in s.lower()]
        if matches:
            self._show_suggestions(matches)
        else:
            self._hide_suggestions()

    def _show_suggestions(self, matches):
        self.suggestion_list.delete(0, "end")
        for m in matches:
            self.suggestion_list.insert("end", "  " + m)

        # Position below the entry widget
        self.update_idletasks()
        x = self.commit_entry.winfo_rootx() - self.winfo_rootx()
        y = self.commit_entry.winfo_rooty() - self.winfo_rooty() + self.commit_entry.winfo_height()
        w = self.commit_entry.winfo_width()
        h = min(len(matches) * 26, 160)

        self.suggestion_frame.place(x=x, y=y, width=w, height=h)
        self.suggestion_frame.lift()
        self._suggestion_visible = True

    def _hide_suggestions(self):
        self.suggestion_frame.place_forget()
        self._suggestion_visible = False

    def _select_suggestion(self, _event=None):
        sel = self.suggestion_list.curselection()
        if sel:
            text = self.suggestion_list.get(sel[0]).strip()
            self.commit_var.set(text)
            self.commit_entry.icursor("end")
        self._hide_suggestions()
        self.commit_entry.focus_set()

    def _focus_suggestions(self, _event=None):
        if self._suggestion_visible:
            self.suggestion_list.focus_set()
            self.suggestion_list.selection_set(0)

    # ── AI Commit Suggestions ───────────────────────────────────────────────

    def _start_ai_suggest(self):
        if self._running or self._suggesting:
            return
        self._suggesting = True
        self.ai_btn.config(state="disabled", text="Thinking...")
        self._set_status("Generating commit suggestions from current changes...")
        threading.Thread(target=self._run_ai_suggest, daemon=True).start()

    def _run_ai_suggest(self):
        def finish_ui(suggestions):
            self._suggesting = False
            self.ai_btn.config(state="normal", text="AI Suggest Commit")
            if suggestions:
                self.dynamic_suggestions = suggestions[:6]
                self.commit_var.set(self.dynamic_suggestions[0])
                self.commit_entry.icursor("end")
                self._show_suggestions(self.dynamic_suggestions)
                self._set_status("AI suggestions ready.", SUCCESS)
                self._log("\n🤖 Suggested commit messages:", "step")
                for msg in self.dynamic_suggestions:
                    self._log(f"  • {msg}", "muted")
            else:
                self._set_status("Could not generate suggestions.", ERROR)
                self._log("No commit suggestions could be generated.", "err")

        try:
            files, diff_text = self._collect_change_context()
            if not files and not diff_text:
                self.after(0, lambda: finish_ui(["No changes to commit"]))
                return

            suggestions = self._request_ai_suggestions(files, diff_text)
            if not suggestions:
                suggestions = self._build_fallback_suggestions(files, diff_text)

            self.after(0, lambda s=suggestions: finish_ui(s))
        except Exception as exc:
            self.after(0, lambda: finish_ui([]))
            self.after(0, lambda: self._log(f"AI suggestion error: {exc}", "err"))

    def _collect_change_context(self):
        names_cmd = "git diff --cached --name-status"
        names = subprocess.run(
            names_cmd, shell=True, cwd=PROJECT_ROOT, capture_output=True, text=True
        ).stdout.strip()

        if not names:
            names = subprocess.run(
                "git diff --name-status HEAD", shell=True, cwd=PROJECT_ROOT, capture_output=True, text=True
            ).stdout.strip()

        diff_cmd = "git diff --cached -- . ':(exclude)release/*'"
        diff_text = subprocess.run(
            diff_cmd, shell=True, cwd=PROJECT_ROOT, capture_output=True, text=True
        ).stdout
        if not diff_text.strip():
            diff_text = subprocess.run(
                "git diff -- . ':(exclude)release/*'", shell=True, cwd=PROJECT_ROOT, capture_output=True, text=True
            ).stdout

        files = []
        for line in names.splitlines():
            parts = line.strip().split(maxsplit=1)
            if len(parts) == 2:
                files.append(parts[1])

        # Keep prompt size in check for API calls.
        trimmed = "\n".join(diff_text.splitlines()[:220])
        return files, trimmed

    def _request_ai_suggestions(self, files, diff_text):
        openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        openai_key = os.getenv("OPENAI_API_KEY", "").strip()

        if openrouter_key:
            provider = "openrouter"
            api_key = openrouter_key
            endpoint = os.getenv("OPENROUTER_API_URL", "https://openrouter.ai/api/v1/chat/completions").strip()
            model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-8b-instruct:free").strip() or "meta-llama/llama-3.3-8b-instruct:free"
        elif openai_key:
            provider = "openai"
            api_key = openai_key
            endpoint = os.getenv("OPENAI_API_URL", "https://api.openai.com/v1/chat/completions").strip()
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
        else:
            return []

        prompt = (
            "You generate concise git commit messages based on code changes. "
            "Return strict JSON only with this shape: {\"suggestions\":[\"msg1\",\"msg2\",\"msg3\"]}. "
            "Messages must be <= 70 chars, imperative mood, and no trailing period.\n\n"
            f"Changed files:\n{os.linesep.join(files) if files else '(none)'}\n\n"
            f"Diff excerpt:\n{diff_text or '(no diff excerpt)'}"
        )

        payload = {
            "model": model,
            "temperature": 0.35,
            "messages": [
                {"role": "system", "content": "You are a senior engineer writing quality commit messages."},
                {"role": "user", "content": prompt},
            ],
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://local-release-tool"
            headers["X-Title"] = "Cyb3rWrld Release Tool"

        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8")
        except (urllib.error.URLError, TimeoutError):
            return []

        try:
            content = json.loads(raw)["choices"][0]["message"]["content"]
            if content.startswith("```"):
                content = content.strip("`")
                if content.lower().startswith("json"):
                    content = content[4:].strip()
            parsed = json.loads(content)
            suggestions = parsed.get("suggestions", [])
            clean = []
            for s in suggestions:
                msg = str(s).strip().replace("\n", " ")
                if msg and msg not in clean:
                    clean.append(msg)
            return clean[:6]
        except Exception:
            return []

    def _build_fallback_suggestions(self, files, diff_text):
        scope = "app"
        if any(f.startswith("electron/") for f in files):
            scope = "electron"
        elif any(f.startswith("src/game/") for f in files):
            scope = "game"
        elif any(f.endswith(".css") for f in files):
            scope = "ui"

        lower_diff = diff_text.lower()
        hints = []
        if "update" in lower_diff or "interval" in lower_diff:
            hints.append(f"Adjust {scope} update behavior")
        if "button" in lower_diff or "layout" in lower_diff or "style" in lower_diff:
            hints.append(f"Polish {scope} interface")
        if "release" in lower_diff or "version" in lower_diff:
            hints.append("Improve release workflow")

        file_count = len(files)
        base = [
            f"Refine {scope} changes across {file_count} file{'s' if file_count != 1 else ''}",
            f"Update {scope} logic and cleanup",
            f"Improve {scope} stability",
        ]

        out = []
        for msg in hints + base + SUGGESTIONS:
            if msg not in out:
                out.append(msg)
            if len(out) >= 6:
                break
        return out

    # ── Release logic ─────────────────────────────────────────────────────────

    def _start_release(self):
        msg = self.commit_var.get().strip()
        if not msg:
            messagebox.showwarning("No message", "Please enter a commit message.")
            return
        if self._running:
            return

        self._clear_log()
        self._running = True
        self._hide_suggestions()
        self.ai_btn.config(state="disabled")
        self.release_btn.config(state="disabled", text="⏳  Running…", bg=MUTED)
        threading.Thread(target=self._run_release, args=(msg,), daemon=True).start()

    def _run_release(self, commit_message):
        version = get_version()

        def log(text, tag=""):
            self.after(0, lambda: self._log(text, tag))

        def done(success):
            def _update():
                self._running = False
                if not self._suggesting:
                    self.ai_btn.config(state="normal")
                if success:
                    self.release_btn.config(state="normal", text="✅  Complete! Run again?", bg=SUCCESS)
                else:
                    self.release_btn.config(state="normal", text="❌  Failed — Try again", bg=ERROR)
            self.after(0, _update)

        def run_cmd(cmd, label):
            """Run a shell command, streaming each output line live to the log."""
            log(f"\n▶ {label}", "step")
            proc = subprocess.Popen(
                cmd, shell=True, cwd=PROJECT_ROOT,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1
            )
            if proc.stdout is not None:
                for line in iter(proc.stdout.readline, ""):
                    stripped = line.rstrip()
                    if stripped:
                        log(stripped, "muted")
                proc.stdout.close()
            proc.wait()
            if proc.returncode != 0:
                log(f"✗ Failed: {label}", "err")
                return False
            return True

        try:
            log(f"📦 Version: v{version}", "version")

            # Check tools
            log("\n🔍 Checking tools…", "step")
            missing = check_tools()
            if missing:
                log(f"✗ Missing tools: {', '.join(missing)}", "err")
                log("Install GitHub CLI: https://github.com/cli/cli", "muted")
                done(False)
                return
            log("✓ All tools found", "ok")

            # Early tag conflict check — prompt to bump before any git work
            tag = f"v{version}"
            existing = subprocess.run(
                f"gh release view {tag}",
                shell=True, cwd=PROJECT_ROOT, capture_output=True, text=True
            )
            if existing.returncode == 0:
                bump_event = threading.Event()
                bump_result = [None]  # type: list[str | None]

                def ask_bump():
                    parts = version.split(".")
                    try:
                        suggested = f"{parts[0]}.{parts[1]}.{int(parts[2]) + 1}"
                    except (IndexError, ValueError):
                        suggested = version + ".1"
                    answer = messagebox.askyesno(
                        "Tag already exists",
                        f"Release {tag} already exists on GitHub.\n\n"
                        f"Bump version to v{suggested} and continue?",
                    )
                    bump_result[0] = suggested if answer else None
                    bump_event.set()

                self.after(0, ask_bump)
                bump_event.wait()

                if bump_result[0] is None:
                    log(f"\n  Aborted — {tag} already exists.", "err")
                    done(False)
                    return

                new_version = bump_result[0]
                pkg_path = os.path.join(PROJECT_ROOT, "package.json")
                with open(pkg_path, encoding="utf-8") as f:
                    pkg_data = json.load(f)
                pkg_data["version"] = new_version
                with open(pkg_path, "w", encoding="utf-8") as f:
                    json.dump(pkg_data, f, indent=2)

                version = new_version
                tag = f"v{new_version}"
                log(f"  ↑ Version bumped to v{new_version}", "ok")
                self.after(0, lambda v=new_version: self.version_label.config(text=f"v{v}"))

            # Git add
            if not run_cmd("git add -A", "Step 1: Adding changes"):
                done(False)
                return

            # Git commit (skip if nothing to commit)
            status = subprocess.run(
                "git status --porcelain", shell=True, cwd=PROJECT_ROOT,
                capture_output=True, text=True
            ).stdout.strip()

            if status:
                if not run_cmd(f'git commit -m "{commit_message}"', "Step 2: Committing changes"):
                    done(False)
                    return
            else:
                log("\n▶ Step 2: Committing changes", "step")
                log("  (nothing to commit, skipping)", "muted")

            # Git push
            if not run_cmd("git push", "Step 3: Pushing to GitHub"):
                done(False)
                return

            # Build
            if not run_cmd("npm run dist", "Step 4: Building app"):
                done(False)
                return

            # Find exe
            log("\n▶ Step 5: Creating GitHub release", "step")
            release_dir = os.path.join(PROJECT_ROOT, "release")
            exe_file = None
            if os.path.isdir(release_dir):
                exes = [f for f in os.listdir(release_dir) if f.lower().endswith(".exe")]
                expected_suffix = f"-{version}.exe"

                # Prefer the EXE matching the current app version.
                for f in exes:
                    if f.endswith(expected_suffix):
                        exe_file = f
                        break

                # Fallback: pick newest EXE if naming is customized.
                if not exe_file and exes:
                    exe_file = max(
                        exes,
                        key=lambda name: os.path.getmtime(os.path.join(release_dir, name))
                    )
                    log(
                        f"  (version-named EXE not found, using newest: {exe_file})",
                        "muted",
                    )

            if not exe_file:
                log("✗ Could not find .exe in release/ folder", "err")
                done(False)
                return

            exe_path = os.path.join(release_dir, exe_file).replace("\\", "/")
            release_notes = f"Release {tag}: {commit_message}"
            gh_cmd = f'gh release create {tag} "{exe_path}" --title "{tag}" --notes "{release_notes}"'

            if not run_cmd(gh_cmd, f"Creating release {tag}"):
                log("Make sure you ran: gh auth login", "muted")
                done(False)
                return

            log("\n╔════════════════════════════════╗", "ok")
            log("║  ✓ Release complete!           ║", "ok")
            log("╚════════════════════════════════╝", "ok")
            log(f"\nVersion : {tag}", "version")
            log(f"Commit  : {commit_message}", "muted")
            log(f"Exe     : {exe_file}", "muted")
            log("\nClients will auto-update on next check.", "muted")
            done(True)

        except Exception as exc:
            log(f"Fatal error: {exc}", "err")
            done(False)


if __name__ == "__main__":
    os.chdir(PROJECT_ROOT)
    app = ReleaseApp()
    app.mainloop()

