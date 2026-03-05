#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageSequence


STATE_KEYS = ["movement", "idle", "writing", "researching", "executing", "syncing", "error"]
STATE_LABELS = {
    "movement": "movement",
    "idle": "idle",
    "writing": "writing",
    "researching": "researching",
    "executing": "executing",
    "syncing": "syncing",
    "error": "error",
}


def round3(value: float) -> float:
    return round(value + 1e-12, 3)


def read_gif_frames(gif_path: Path) -> Tuple[List[Image.Image], float]:
    gif = Image.open(gif_path)
    frames = [frame.copy().convert("RGBA") for frame in ImageSequence.Iterator(gif)]
    durations = [frame.info.get("duration", 100) for frame in ImageSequence.Iterator(Image.open(gif_path))]
    if not frames:
        raise ValueError(f"No frames found: {gif_path}")
    avg_ms = float(sum(durations)) / float(len(durations)) if durations else 100.0
    return frames, avg_ms


def write_spritesheet(frames: List[Image.Image], output_path: Path) -> Dict[str, int]:
    frame_width, frame_height = frames[0].size
    frame_count = len(frames)
    normalized = []
    for frame in frames:
        if frame.size != (frame_width, frame_height):
            normalized.append(frame.resize((frame_width, frame_height), Image.Resampling.NEAREST))
        else:
            normalized.append(frame)
    sheet = Image.new("RGBA", (frame_width * frame_count, frame_height), (0, 0, 0, 0))
    for index, frame in enumerate(normalized):
        sheet.paste(frame, (index * frame_width, 0))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)
    return {
        "frameWidth": frame_width,
        "frameHeight": frame_height,
        "frames": frame_count,
    }


def frame_rate_from_ms(avg_ms: float) -> int:
    if avg_ms <= 0:
        return 6
    return max(1, round(1000.0 / avg_ms))


def to_static_path(path: Path, frontend_dir: Path) -> str:
    try:
        rel = path.resolve().relative_to(frontend_dir.resolve())
    except Exception as exc:
        raise ValueError(f"Output must be inside frontend dir: {path}") from exc
    return "/static/" + str(rel).replace("\\", "/")


def auto_scan_mapping(theme_dir: Path, character: str) -> Dict[str, Path]:
    mapping: Dict[str, Path] = {}
    for state in STATE_KEYS:
        suffix = "walking" if state == "movement" else state
        candidate = theme_dir / f"{character}_{suffix}.gif"
        if candidate.exists():
            mapping[state] = candidate
    return mapping


def sync_theme(theme_json_path: Path, theme_dir: Path, mapping: Dict[str, Path], dry_run: bool = False) -> Dict[str, dict]:
    with open(theme_json_path, "r", encoding="utf-8") as handle:
        theme = json.load(handle)

    assets = theme.setdefault("assets", {})
    hero_asset = assets.setdefault("hero", {})
    hero_states = assets.setdefault("heroStates", {})
    root_hero = theme.setdefault("hero", {})
    root_hero_scale = float(root_hero.get("scale", 1.0))

    frontend_dir = Path("frontend")
    converted: Dict[str, dict] = {}
    for state, gif_path in mapping.items():
        if not gif_path.exists():
            continue
        frames, avg_ms = read_gif_frames(gif_path)
        sheet_name = gif_path.stem + "-spritesheet.png"
        output_path = theme_dir / sheet_name
        sheet_meta = write_spritesheet(frames, output_path) if not dry_run else {
            "frameWidth": frames[0].size[0],
            "frameHeight": frames[0].size[1],
            "frames": len(frames),
        }
        sheet_meta["frameRate"] = frame_rate_from_ms(avg_ms)
        sheet_meta["png"] = to_static_path(output_path, frontend_dir)
        converted[state] = sheet_meta

    if "movement" in converted:
        m = converted["movement"]
        hero_asset.clear()
        hero_asset.update({
            "png": m["png"],
            "frameWidth": m["frameWidth"],
            "frameHeight": m["frameHeight"],
            "frames": m["frames"],
            "frameRate": m["frameRate"],
        })

    base_display_height = float(hero_asset.get("frameHeight", 1)) * root_hero_scale

    for state in ["idle", "writing", "researching", "executing", "syncing", "error"]:
        if state not in converted:
            continue
        meta = converted[state]
        existing = hero_states.get(state, {})
        if isinstance(existing, dict) and "scale" in existing:
            state_scale = float(existing["scale"])
        else:
            state_scale = round3(base_display_height / float(meta["frameHeight"]))

        hero_states[state] = {
            "png": meta["png"],
            "frameWidth": meta["frameWidth"],
            "frameHeight": meta["frameHeight"],
            "frames": meta["frames"],
            "frameRate": meta["frameRate"],
            "scale": state_scale,
        }

    if not dry_run:
        with open(theme_json_path, "w", encoding="utf-8") as handle:
            json.dump(theme, handle, ensure_ascii=False, indent=2)
            handle.write("\n")

    return converted


def parse_state_mappings(state_args: List[str]) -> Dict[str, Path]:
    mapping: Dict[str, Path] = {}
    for item in state_args:
        if "=" not in item:
            continue
        state, file_path = item.split("=", 1)
        state = state.strip().lower()
        if state not in STATE_KEYS:
            continue
        mapping[state] = Path(file_path.strip())
    return mapping


def launch_gui(default_theme_dir: Path, default_theme_json: Path, default_character: str) -> Tuple[Path, Path, Dict[str, Path], bool] | None:
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox
    except Exception:
        return None

    result: Dict[str, object] = {"ok": False}
    root = tk.Tk()
    root.title("Agent GIF Sync Tool")
    root.geometry("980x560")
    root.resizable(True, True)

    theme_dir_var = tk.StringVar(value=str(default_theme_dir))
    theme_json_var = tk.StringVar(value=str(default_theme_json))
    character_var = tk.StringVar(value=default_character)
    dry_run_var = tk.BooleanVar(value=False)
    state_vars: Dict[str, tk.StringVar] = {key: tk.StringVar(value="") for key in STATE_KEYS}

    def browse_theme_dir() -> None:
        selected = filedialog.askdirectory(initialdir=theme_dir_var.get() or ".")
        if not selected:
            return
        theme_dir_var.set(selected)
        theme_json_var.set(str(Path(selected) / "theme.json"))

    def browse_theme_json() -> None:
        selected = filedialog.askopenfilename(
            initialdir=str(Path(theme_json_var.get()).parent if theme_json_var.get() else "."),
            filetypes=[("JSON", "*.json"), ("All", "*.*")],
        )
        if selected:
            theme_json_var.set(selected)

    def browse_gif(state: str) -> None:
        selected = filedialog.askopenfilename(
            initialdir=theme_dir_var.get() or ".",
            filetypes=[("GIF", "*.gif"), ("All", "*.*")],
        )
        if selected:
            state_vars[state].set(selected)

    def auto_fill() -> None:
        base_dir = Path(theme_dir_var.get().strip())
        name = character_var.get().strip()
        if not name:
            messagebox.showerror("Error", "character is empty")
            return
        mapping = auto_scan_mapping(base_dir, name)
        for key in STATE_KEYS:
            state_vars[key].set(str(mapping.get(key, "")))

    def on_run() -> None:
        theme_dir = Path(theme_dir_var.get().strip())
        theme_json = Path(theme_json_var.get().strip())
        if not theme_json.exists():
            messagebox.showerror("Error", f"theme.json not found:\n{theme_json}")
            return
        selected_mapping: Dict[str, Path] = {}
        for state in STATE_KEYS:
            p = state_vars[state].get().strip()
            if p:
                selected_mapping[state] = Path(p)
        if not selected_mapping:
            messagebox.showerror("Error", "No GIF selected")
            return
        result["ok"] = True
        result["theme_dir"] = theme_dir
        result["theme_json"] = theme_json
        result["mapping"] = selected_mapping
        result["dry_run"] = bool(dry_run_var.get())
        root.destroy()

    def on_cancel() -> None:
        root.destroy()

    frame = tk.Frame(root, padx=10, pady=10)
    frame.pack(fill="both", expand=True)

    tk.Label(frame, text="Theme Dir").grid(row=0, column=0, sticky="w")
    tk.Entry(frame, textvariable=theme_dir_var, width=80).grid(row=0, column=1, sticky="we", padx=4)
    tk.Button(frame, text="Browse", command=browse_theme_dir).grid(row=0, column=2, padx=4)

    tk.Label(frame, text="theme.json").grid(row=1, column=0, sticky="w")
    tk.Entry(frame, textvariable=theme_json_var, width=80).grid(row=1, column=1, sticky="we", padx=4)
    tk.Button(frame, text="Browse", command=browse_theme_json).grid(row=1, column=2, padx=4)

    tk.Label(frame, text="Character Prefix").grid(row=2, column=0, sticky="w")
    tk.Entry(frame, textvariable=character_var, width=30).grid(row=2, column=1, sticky="w", padx=4)
    tk.Button(frame, text="Auto Fill by Prefix", command=auto_fill).grid(row=2, column=2, padx=4)

    r = 4
    for state in STATE_KEYS:
        tk.Label(frame, text=STATE_LABELS[state]).grid(row=r, column=0, sticky="w")
        tk.Entry(frame, textvariable=state_vars[state], width=80).grid(row=r, column=1, sticky="we", padx=4)
        tk.Button(frame, text="Select GIF", command=lambda s=state: browse_gif(s)).grid(row=r, column=2, padx=4)
        r += 1

    tk.Checkbutton(frame, text="Dry Run", variable=dry_run_var).grid(row=r, column=0, sticky="w")
    tk.Button(frame, text="Run", command=on_run, width=18).grid(row=r, column=1, sticky="w", padx=4)
    tk.Button(frame, text="Cancel", command=on_cancel, width=18).grid(row=r, column=1, sticky="e", padx=4)

    frame.grid_columnconfigure(1, weight=1)
    root.mainloop()

    if not result.get("ok"):
        return None
    return (
        result["theme_dir"],  # type: ignore[return-value]
        result["theme_json"],  # type: ignore[return-value]
        result["mapping"],  # type: ignore[return-value]
        bool(result["dry_run"]),
    )


def print_summary(theme_json_path: Path, converted: Dict[str, dict], dry_run: bool) -> None:
    print(f"Theme: {theme_json_path}")
    print(f"Converted: {len(converted)}")
    print(f"Dry Run: {dry_run}")
    for key in STATE_KEYS:
        if key not in converted:
            continue
        data = converted[key]
        print(
            f"- {key}: {data['frames']}f {data['frameWidth']}x{data['frameHeight']} @ {data['frameRate']}fps -> {Path(data['png']).name}"
        )
    print("Done.")


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generic agent GIF -> spritesheet -> theme.json tool")
    parser.add_argument("--theme-dir", default="frontend/themes/liangshan", help="Theme directory")
    parser.add_argument("--theme-json", default=None, help="theme.json path (default: <theme-dir>/theme.json)")
    parser.add_argument("--character", default="songjiang", help="Character prefix for auto scan")
    parser.add_argument("--scan", action="store_true", help="Auto scan by <character>_<state>.gif")
    parser.add_argument("--state", action="append", default=[], help="Manual mapping: state=path/to/file.gif")
    parser.add_argument("--gui", action="store_true", help="Launch GUI selector")
    parser.add_argument("--dry-run", action="store_true", help="Show plan only, do not write theme.json")
    args = parser.parse_args(argv)

    theme_dir = Path(args.theme_dir)
    theme_json_path = Path(args.theme_json) if args.theme_json else (theme_dir / "theme.json")

    mapping: Dict[str, Path] = {}
    mapping.update(parse_state_mappings(args.state))
    if args.scan:
        mapping.update(auto_scan_mapping(theme_dir, args.character))

    use_gui = args.gui or (not mapping)
    if use_gui:
        gui_result = launch_gui(theme_dir, theme_json_path, args.character)
        if gui_result is None:
            print("GUI unavailable or canceled.")
            return 1
        theme_dir, theme_json_path, mapping, dry_run = gui_result
    else:
        dry_run = args.dry_run

    if not mapping:
        print("No GIF mapping provided.")
        return 1
    if not theme_json_path.exists():
        print(f"theme.json not found: {theme_json_path}")
        return 1

    converted = sync_theme(theme_json_path, theme_dir, mapping, dry_run=dry_run)
    print_summary(theme_json_path, converted, dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
