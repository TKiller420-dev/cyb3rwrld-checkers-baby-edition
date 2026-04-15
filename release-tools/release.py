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
        self._suggestion_visible = False

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
        matches = [s for s in SUGGESTIONS if query in s.lower()]
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
        self.release_btn.config(state="disabled", text="⏳  Running…", bg=MUTED)
        threading.Thread(target=self._run_release, args=(msg,), daemon=True).start()

    def _run_release(self, commit_message):
        version = get_version()

        def log(text, tag=""):
            self.after(0, lambda: self._log(text, tag))

        def done(success):
            def _update():
                self._running = False
                if success:
                    self.release_btn.config(state="normal", text="✅  Complete! Run again?", bg=SUCCESS)
                else:
                    self.release_btn.config(state="normal", text="❌  Failed — Try again", bg=ERROR)
            self.after(0, _update)

        def run_cmd(cmd, label):
            log(f"\n▶ {label}", "step")
            result = subprocess.run(
                cmd, shell=True, cwd=PROJECT_ROOT, capture_output=True, text=True
            )
            if result.stdout.strip():
                log(result.stdout.strip(), "muted")
            if result.returncode != 0:
                if result.stderr.strip():
                    log(result.stderr.strip(), "err")
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
                for f in os.listdir(release_dir):
                    if f.endswith(".exe"):
                        exe_file = f
                        break

            if not exe_file:
                log("✗ Could not find .exe in release/ folder", "err")
                done(False)
                return

            exe_path = os.path.join(release_dir, exe_file).replace("\\", "/")
            release_notes = f"Release v{version}: {commit_message}"
            gh_cmd = f'gh release create v{version} "{exe_path}" --title "v{version}" --notes "{release_notes}"'

            if not run_cmd(gh_cmd, f"Creating release v{version}"):
                log("Make sure you ran: gh auth login", "muted")
                done(False)
                return

            log("\n╔════════════════════════════════╗", "ok")
            log("║  ✓ Release complete!           ║", "ok")
            log("╚════════════════════════════════╝", "ok")
            log(f"\nVersion : v{version}", "version")
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
