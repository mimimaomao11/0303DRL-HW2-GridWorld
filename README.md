# 🌐 GridWorld — Value Iteration Visualizer

> **Course:** Deep Reinforcement Learning — HW2  
> **Tech Stack:** Flask · Python · Vanilla JS · HTML/CSS  
> **Demo:** https://0303drl-hw2-gridworld-production.up.railway.app/

---

## 📌 專案簡介

本專案實作一個互動式 **GridWorld MDP 視覺化工具**，使用者可以：

1. 自訂 n×n 網格大小（3 ~ 10）
2. 點擊格子設定起點、終點與障礙物
3. 按下「Generate Value & Policy」，後端使用 **Value Iteration** 演算法計算最優策略
4. 即時顯示三個並列矩陣：
   - **Interactive Grid** — 操作區（起點綠、終點紅、障礙物灰）
   - **Policy Matrix** — 每個格子的最優行動箭頭（↑ ↓ ← →）
   - **Value Matrix** — 每個狀態的 V(s) 價值

所有計算透過 **AJAX / fetch** 與 Flask 後端通訊，無頁面重整。

---

## 🖼️ 截圖預覽

### 初始狀態（Policy Matrix 預填隨機箭頭）
> 建立網格後，Policy Matrix 會自動以隨機方向箭頭預填，等待計算

### 計算後（三矩陣並列）
> 按下 Generate 後，三個矩陣即時更新

---

## 🧮 MDP 設定

| 參數 | 值 |
|---|---|
| 折扣因子 γ | **0.9** |
| 收斂閾值 θ | **0.0001** |
| 終點獎勵 | **+10**（V(Goal) 固定為 10.00） |
| 障礙物懲罰 | **−10**（撞到障礙物留在原地） |
| 一般移動 | **−1**（每步固定步數代價） |
| 行為空間 | ↑ ↓ ← →（Tie-break 優先序：上>下>左>右） |
| 終點 V(s) | **10.00**（吸收狀態） |
| 障礙物 V(s) | **0.00**（不參與計算） |

### Bellman 更新方程式

```
V(s) = max_a [ R(s,a) + γ × V(s') ]

其中：
  R = -1     一般移動
  R = -10    撞牆後留在原地（障礙物）
  V(goal)    固定為 10.0（吸收狀態）
```

---

## 🕹️ 使用說明

| 步驟 | 操作 |
|---|---|
| 1 | 在輸入框輸入網格大小（3 ~ 10），點擊 **Create Grid** |
| 2 | 點擊第 **1** 個格子 → 設為**起點**（綠色 S） |
| 3 | 點擊第 **2** 個格子 → 設為**終點**（紅色 E） |
| 4 | 繼續點擊其他格子 → 設為**障礙物**（灰色，最多 n−2 個） |
| 5 | 點擊 **Generate Value & Policy** 計算 |
| ✅ | 三個矩陣即時更新，無頁面重整 |

> **貼心提示：**  
> - 再次點擊已設定的格子可**取消**該設定  
> - 點擊 **Reset** 清除所有設定並重新生成隨機 Policy  

---

## 📁 專案結構

```
HW2/
├── app.py                  # Flask 後端 + Value Iteration 演算法
├── templates/
│   └── index.html          # 主頁面 HTML（含 CSS）
├── static/
│   └── script.js           # 前端邏輯（AJAX + 矩陣動態渲染）
├── README.md               # 本文件
└── 對話紀錄with Antigravity.md   # AI 輔助開發對話紀錄
```

---

## 🚀 本機執行

### 前置需求

- Python 3.8+
- pip

### 安裝與啟動

```bash
# 1. 進入專案目錄
cd HW2

# 2. 安裝依賴
pip install flask numpy

# 3. 啟動 Flask 伺服器
python app.py
```

### 開啟瀏覽器

```
http://127.0.0.1:5000
```

---

## ⚙️ API 說明

### `POST /compute`

**Request Body（JSON）：**

```json
{
  "n": 5,
  "start": [0, 0],
  "end": [4, 4],
  "obstacles": [[1, 1], [2, 2], [3, 3]],
  "gamma": 0.9,            // optional, 0<=gamma<=1
  "theta": 0.0001          // optional, convergence threshold > 0
}
```

**Response（JSON）：**

```json
{
  "v_matrix": [[10.0, 8.0, ...], ...],
  "p_matrix": [["↓", "→", ...], ["G", ...]],
  "start": [0, 0],
  "end": [4, 4]
}
```

| 欄位 | 說明 |
|---|---|
| `v_matrix` | n×n 二維陣列，每格的 V(s) 值（float，四捨五入至 2 位） |
| `p_matrix` | n×n 二維陣列，每格的最優策略（↑↓←→ / G / X） |
| `start` | 起點座標 [row, col] |
| `end` | 終點座標 [row, col] |

Notes:
- The server performs input validation and will return HTTP 400 with an error message for invalid requests (out-of-bounds coordinates, too many obstacles, invalid types, etc.).
- The `start` field is primarily used by the UI; the value-iteration routine computes the full value/policy grid and does not depend on the chosen start state.

---

## 🔬 演算法流程

```
1. 初始化 V(s) = 0  for all s
   固定 V(goal) = 10（吸收狀態）
   固定 V(obstacle) = 0（不更新）

2. 重複直到收斂（delta < θ）:
   for each state s (非 goal, 非 obstacle):
     for each action a in {↑, ↓, ←, →}:
       計算 next_state s'
       if s' 撞障礙: reward = -10, s' = s
       else: reward = -1
       Q(s,a) = reward + γ × V(s')
     
     V(s) = max Q(s,a)
     policy(s) = argmax Q(s,a)  [tie-break: ↑>↓>←>→]
     delta = max(delta, |newV(s) - V(s)|)

3. 回傳 V 矩陣與 policy 矩陣
```

---

## 📋 互動規則

- **障礙物上限**：嚴格限制為 **n − 2** 個
- **顏色對應**：起點 🟢 綠、終點 🔴 紅、障礙物 ⬜ 灰
- **Policy 顯示**：G（終點）、箭頭（一般格）、灰塊（障礙物）
- **Value 顯示**：所有數值保留 **2 位小數**

UI notes:
- The Policy Matrix is prefilled with random arrows when the grid is created (placeholder). Click **Generate Value & Policy** to compute the true optimal policy.
- You can adjust `γ` and `θ` from the UI before computing to explore different behaviors.

---

*Last updated: 2026-03-16*
