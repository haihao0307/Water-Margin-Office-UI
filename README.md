# Water Margin-Office-UI

A derivative work based on [ringhyacinth/Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI).

This project remakes the original "Pixel Office Status Board" into a "Liangshan-themed Pixel Board," using more narrative-driven scenes, characters, animations, and sound effects to represent the status changes of AI/Agents.

## Project Features

1. Liangshan-themed Pixel Scene

- Layered rendering of background and foreground (`bg` + `bg_fg`)

- Characters can be occluded by foreground elements such as pillars/door frames, resulting in a more natural visual effect.

2. State-Driven Character Behavior

- Supported states: `idle` / `writing` / `researching` / `executing` / `syncing` / `error`

- When switching states, the character will first move, playing a walking animation during the movement, and then playing the corresponding state animation upon reaching the desired state.

3. Configurable Theme Engine (Frontend)

- Scenes, characters, coordinates, effects, and decorations all use `theme.json`.

- Supports reusable spritesheet decorations (e.g., flags, water surfaces, lanterns).

4. Character State Sound Effect System (Scalable to multiple characters)

- Audio naming convention: `<role>_<state>.mp3`

- For example: `songjiang_idle.mp3`

- Supports automatic character-level recognition and state switching. Sound effect triggering logic: The corresponding sound effect is played only after the character reaches the state target point.

5. Dual-panel UI

- Control Panel: Directly calls `/set_state`

- Yesterday's Memo: Reads `/yesterday-memo`

6. Beginner-friendly

- No npm packaging required, direct connection to static scripts

- Provides a one-click tool (including GUI) for GIF -> spritesheet -> `theme.json`

---

## Current Version Range (V2)

Completed:

- Complete state animation flow for a single protagonist (Song Jiang)

- Layered background and foreground occlusion

- Configurable decoration animations

- Character state sound effects (matched by character name prefix)

- Dual-panel (control panel + Yesterday's Memo)

Planned (V3+):

- Multiple Agents and multiple characters on screen simultaneously (each agent maps to a different hero image)

- Independent speech bubble, nameplate, and sound effect mapping for each agent

---

## Quick Start

### 1) Clone the repository and enter the directory

```bash
git clone https://github.com/haihao0307/Water Margin-Office-UI.git
cd <your-repo>

```

If you are creating a derivative work from the original project, you can also clone the original repository first:

```bash
git clone https://github.com/ringhyacinth/Star-Office-UI.git
cd Star-Office-UI

```

### 2) Install dependencies

```bash
python -m pip install -r backend/requirements.txt

```

### 3) Start the backend

```bash
python backend/app.py

```

### 4) Open the page

```text
http://127.0.0.1:18791

```

### 5) Test the state switch (execute in the project root directory)

```bash
python set_state.py idle "On standby"
python set_state.py writing "Writing copy"
python set_state.py researching "Researching"
python set_state.py executing "Executing"
python set_state.py syncing "Synchronizing"
python set_state.py error "An error occurred"

```

---

## Theme Resource Directory Conventions

Directory: `frontend/themes/liangshan/`

Common Files:

- `bg.png` / `bg.webp`

- `bg_fg.png` / `bg_fg.webp`

- `theme.json`

Main Character Animation (Current Song Jiang):

- `songjiang_walking.gif`

- `songjiang_idle.gif`

- `songjiang_writing.gif`

- `songjiang_researching.gif`

- `songjiang_executing.gif`

- `songjiang_syncing.gif`

- `songjiang_error.gif`

Audio Directory: `frontend/themes/liangshan/audio/`

- `songjiang_idle.mp3`

- `songjiang_writing.mp3`

- `songjiang_researching.mp3`

- `songjiang_executing.mp3`

- `songjiang_syncing.mp3`

- `songjiang_error.mp3`

Rules:

- Filename must be `<role>_<state>.mp3`

- `role` is currently determined by `hero.role` in `theme.json` (default is `songjiang`)

---

## One-Click Sync Role GIF (Recommended)

### GUI Point-and-Click Mode (Recommended for Beginners)

```powershell python sync_agent_theme.py` --gui

```

Or double-click directly:

```text
launch_sync_agent_theme_gui.bat

```

### Automatic Scan Mode

```powershell
python sync_agent_theme.py --character songjiang --scan

```

### Compatible with Old Commands

```powershell
python sync_songjiang_theme.py

```

This tool does three things:

1. Read GIF frames

2. Generate spritesheet PNGs

3. Automatically update corresponding fields in `theme.json`

---

## API Overview

- `GET /health`: Health check

- `GET /status`: Get primary role status

- `POST /set_state`: Set primary role status

- `GET /yesterday-memo`: Get yesterday's notes

The backend already includes multi-Agent related interfaces (frontend multi-role display is still under planning):

- `GET `/agents`

- `POST /join-agent`

- `POST /agent-push`

- `POST /leave-agent`

- `POST /agent-approve`

- `POST /agent-reject`

---

## Frequently Asked Questions (FAQ)

1) Why is there no sound after the status changes?

- Browsers usually require user interaction before playing audio. Click once on the page, or click the `sound effects` button at the top.

2) Why does the character "walk into the wall"?

- You need to adjust the `positions` coordinates in `theme.json`. It is recommended to enable coordinate debugging and then select the target position for fine-tuning.

3) Why does the script report that it cannot find `state.json`?

- You are likely not in the project root directory. First `cd` to the project root directory and then execute `python set_state.py ...`.

4) Why is the page not updating even though there are assets?

- First, refresh the page: `Ctrl + F5`, and confirm that the file path, filename, and `theme.json` match.

---

## Acknowledgements and Sources

This project is a derivative work of the original project. Thanks to the original author for open-sourcing it:

- Original Repository:

[ringhyacinth/Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI)

- Original Author: Ring Hyacinth and Contributors

If you like this derivative version of the project, please also give the original project a Star.

---

## Open Source and Usage Declaration

- Code Logic: Follows this repository's `LICENSE` (MIT)

- Art/Audio Materials: Please use according to their respective sources and licensing rules.

- If used for public release or commercial purposes, please replace them with your own original materials that you are authorized to use.

---

## Project Structure (Simplified Version)

```text
Water Margin-Office-UI/
backend/
app.py
requirements.txt

frontend/
index.html

css/app.css

js/app.js

js/theme-engine.js

js/panels/

themes/liangshan/

theme.json

bg.png

bg_fg.png

audio/

props/

set_state.py

sync_agent_theme.py

sync_songjiang_theme.py

launch_sync_agent_theme_gui.bat

README.md

LICENSE
```


# Water Margin-Office-UI

基於 [ringhyacinth/Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI) 的二次創作版本。
本專案將原「像素辦公室狀態看板」重製為「梁山主題像素看板」，把 AI/Agent 的狀態變化用更有敘事感的場景、角色、動畫和音效表現出來。

## 專案特色

1. 梁山主題像素場景
- 背景與前景分層渲染（`bg` + `bg_fg`）
- 角色可被柱子/門框等前景元素遮擋，畫面更自然

2. 狀態驅動的角色行為
- 狀態支援：`idle` / `writing` / `researching` / `executing` / `syncing` / `error`
- 切狀態時角色會先走位，移動中播放走路動畫，到點後播放對應狀態動畫

3. 可設定主題引擎（前端）
- 場景、角色、座標、特效、裝飾物全部走 `theme.json`
- 支援可重複使用 spritesheet 裝飾物（例如旗幟、水面、燈籠）

4. 角色狀態音效系統（可擴展到多角色）
- 音訊命名規則：`<role>_<state>.mp3`
- 例如：`songjiang_idle.mp3`
- 支援角色級自動識別與狀態切換
- 音效觸發邏輯：角色到達狀態目標點後才播放對應音效

5. 雙面板 UI
- 控制台：直接呼叫 `/set_state`
- 昨日小記：讀取 `/yesterday-memo`

6. 對新手友好
- 無需 npm 打包，靜態腳本直連
- 提供 GIF -> spritesheet -> `theme.json` 的一鍵工具（含 GUI）

---

## 目前版本範圍（V2）

已完成：
- 單一主角（宋江）完整狀態動畫流程
- 背景前景分層遮擋
- 可配置裝飾物動畫
- 角色狀態音效（以角色名稱前綴相符）
- 雙面板（控制 + 昨天小記）

計劃中（V3+）：
- 多 Agent 多角色同畫面（每個 agent 映射不同好漢形象）
- 每個 agent 獨立氣泡、名字牌、音效映射

---

## 快速開始

### 1) 複製倉庫並進入目錄

『`bash
git clone https://github.com/haihao0307/Water Margin-Office-UI.git
cd <your-repo>
```

如果你是從原項目開始二創，也可以先克隆原倉庫：

『`bash
git clone https://github.com/ringhyacinth/Star-Office-UI.git
cd Star-Office-UI
```

### 2) 安裝依賴

『`bash
python -m pip install -r backend/requirements.txt
```

### 3) 啟動後端

『`bash
python backend/app.py
```

### 4) 開啟頁面

```text
http://127.0.0.1:18791
```

### 5) 切換狀態測試（在專案根目錄執行）

『`bash
python set_state.py idle "待命"
python set_state.py writing "寫文案"
python set_state.py researching "查資料"
python set_state.py executing "執行中"
python set_state.py syncing "同步中"
python set_state.py error "出錯了"
```

---

## 主題資源目錄約定

目錄：`frontend/themes/liangshan/`

常用文件：
- `bg.png` / `bg.webp`
- `bg_fg.png` / `bg_fg.webp`
- `theme.json`

主角動畫（當前宋江）：
- `songjiang_walking.gif`
- `songjiang_idle.gif`
- `songjiang_writing.gif`
- `songjiang_researching.gif`
- `songjiang_executing.gif`
- `songjiang_syncing.gif`
- `songjiang_error.gif`

音頻目錄：`frontend/themes/liangshan/audio/`
- `songjiang_idle.mp3`
- `songjiang_writing.mp3`
- `songjiang_researching.mp3`
- `songjiang_executing.mp3`
- `songjiang_syncing.mp3`
- `songjiang_error.mp3`

規則：
- 檔名必須是 `<role>_<state>.mp3`
- `role` 目前由 `theme.json` 的 `hero.role` 決定（預設 `songjiang`）

---

## 一鍵同步角色 GIF（建議）

### GUI 點選模式（新手推薦）

```powershell
python sync_agent_theme.py --gui
```

或直接雙擊：

```text
launch_sync_agent_theme_gui.bat
```

### 自動掃描模式

```powershell
python sync_agent_theme.py --character songjiang --scan
```

### 相容舊指令

```powershell
python sync_songjiang_theme.py
```

該工具會做三件事：
1. 讀取 GIF 幀
2. 產生 spritesheet PNG
3. 自動更新 `theme.json` 對應字段

---

## API 一覽

- `GET /health`：健康檢查
- `GET /status`：取得主角色狀態
- `POST /set_state`：設定主角色狀態
- `GET /yesterday-memo`：取得昨日小記

後端已包含多 Agent 相關介面（前端多角色展示仍在規劃中）：
- `GET /agents`
- `POST /join-agent`
- `POST /agent-push`
- `POST /leave-agent`
- `POST /agent-approve`
- `POST /agent-reject`

---

## 常見問題（FAQ）

1) 為什麼狀態切了但沒聲音？
- 瀏覽器通常要求使用者互動後才能播放音訊。先在頁面點擊一次，或點擊頂部 `音效` 按鈕。

2) 為什麼角色會「走到牆裡」？
- 需要調整 `theme.json` 裡的 `positions` 座標。建議開啟座標調試後點選目標位置微調。

3) 為什麼腳本提示找不到 `state.json`？
- 你很可能不在專案根目錄。先 `cd` 到專案根目錄再執行 `python set_state.py ...`。

4) 為什麼有素材但頁面不更新？
- 先強刷頁面：`Ctrl + F5`，並確認檔案路徑與檔案名稱和 `theme.json` 一致。

---

## 致謝與來源

本專案以原專案二次創作，感謝原作者開源：

- 原倉庫：
 [ringhyacinth/Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI)

- 原作者：Ring Hyacinth 及貢獻者

如果你喜歡這個梁山二創版本，也請給原專案一個 Star。

---

## 開源與使用聲明

- 程式碼邏輯：遵循本倉庫 `LICENSE`（MIT）
- 美術/音訊等素材：請依各自來源與授權規則使用
- 若用於公開發布或商用，請務必替換為你有權使用的原創素材

---

## 專案結構（簡版）

```text
Water Margin-Office-UI/
 backend/
 app.py
 requirements.txt
 frontend/
 index.html
 css/app.css
 js/app.js
 js/theme-engine.js
 js/panels/
 themes/liangshan/
 theme.json
 bg.png
 bg_fg.png
 audio/
 props/
 set_state.py
 sync_agent_theme.py
 sync_songjiang_theme.py
 launch_sync_agent_theme_gui.bat
 README.md
 LICENSE
```