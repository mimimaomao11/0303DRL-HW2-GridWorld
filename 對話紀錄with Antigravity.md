# GridWorld HW2 — 對話紀錄匯出
> 對話時間：2026-03-11  
> 工具：Antigravity AI Coding Assistant  
> 專案路徑：`c:\Users\wawa8\Desktop\DRL\HW2`

---

## 第一輪對話 — HW1-1 修正 + HW1-2 實作規劃

**USER 需求：**
- 修正 HW1-1 的網格點擊邏輯 Bug（點擊順序錯誤、障礙物數量限制未實作）
- 實作 HW1-2 的 Value Iteration 演算法（V(s) 計算 + Policy 矩陣）
- 三個矩陣並列顯示（Interactive Grid、Policy Matrix、Value Matrix）
- 全程透過 AJAX 與 Flask 後端通訊，不重整頁面

**AI 回應 / 修改內容：**

### `app.py` — 後端
- 實作 `value_iteration(n, obstacles, start, terminal)` 函式
- MDP 參數：γ = 0.9，θ = 0.0001（收斂條件）
- 獎勵設定：到達終點 +10，障礙物 −10，一般移動 −1
- 行為空間：上/下/左/右（撞牆或邊界則留在原地）
- 接受 `start` 座標並在 JSON response 中回傳
- 新增 `/compute` POST 端點

### `static/script.js` — 前端互動邏輯
- 修正點擊順序：第 1 次 = 起點（綠）、第 2 次 = 終點（紅）、後續 = 障礙物（灰）
- 實作 Toggle Off（再次點擊取消設定）
- 障礙物上限嚴格限制為 `n - 2` 個
- `createGrid()` / `resetGrid()` 後自動以隨機箭頭預填 Policy Matrix
- `compute()` 透過 `fetch()` 送出 AJAX 請求

### `templates/index.html` — 版面
- 加入 `display: flex` wrapper 讓三個矩陣水平並列
- 不更動任何現有 HTML 標籤或 CSS class

---

## 第二輪對話 — 精細調整（對齊作業範例）

**USER 需求：**
- 終點 Value = 10.00（而非 0）
- 障礙物 Value = 0.00
- Tie-breaking：相同 Q-value 時用「上 > 下 > 左 > 右」優先序
- Policy Matrix 終點改顯示 `G`（紅底），不顯示箭頭
- Policy Matrix 起點顯示計算後的最優方向箭頭（綠底）
- 所有數值強制保留兩位小數
- 障礙物限制隨 n 動態計算

**AI 修改內容：**

### `app.py` 修正
```python
# 終點作為吸收狀態，V(goal) 固定為 10.0
if state == term:
    newV[r][c] = 10.0
    continue

# Tie-breaking: np.argmax FIRST match → 上>下>左>右
best = int(np.argmax(q_values))

# 終點標記改為 "G"
policy[term[0]][term[1]] = "G"
```

### `script.js` 修正
```javascript
// Policy Matrix: 終點顯示 G (紅底)
if (isGoal) {
    cell.className = "cell end"
    cell.textContent = "G"
}
// Policy Matrix: 起點顯示最優箭頭 (綠底)
else if (isStart) {
    cell.className = "cell start"
    cell.textContent = val  // val = 計算後的箭頭
}
// Value Matrix: 所有值 toFixed(2)
cell.textContent = V[r][c].toFixed(2)
```

---

## 第三輪對話 — Bug 修正：Value Matrix 數值異常

**USER 問題：** Value Matrix 中的數值怪怪的（過高）

**根本原因（雙重計算 Bug）：**
```python
# 問題：同時設定了兩個「終點獎勵」
newV[goal] = 10.0         # ① V(goal) 固定為 10
...
elif next_state == term:
    reward = 10            # ② 轉移到 goal 時 reward 又給 +10
# → Q(相鄰→goal) = 10 + 0.9×10 = 19  ← 數值膨脹！
```

**修正方式：**
```python
# 修正後：transition 到 goal 只扣 step cost (-1)
# V(goal) = 10 已編碼終止獎勵，不需再加 reward = +10
if next_state in obstacle_set:
    reward = -10
    nr, nc = r, c
else:
    reward = -1  # 包含轉移到 goal 的情況
```

**修正後正確數值（5×5 無障礙）：**

| 離終點距離 | 公式 | V(s) |
|---|---|---|
| 0（終點） | 固定 | 10.00 |
| 1 步 | −1 + 0.9 × 10 | 8.00 |
| 2 步 | −1 + 0.9 × 8 | 6.20 |
| 3 步 | −1 + 0.9 × 6.2 | 4.58 |
| 4 步 | −1 + 0.9 × 4.58 | 3.12 |

---

## 最終檔案結構

```
HW2/
├── app.py                  # Flask 後端 + Value Iteration
├── templates/
│   └── index.html          # 主頁面
├── static/
│   └── script.js           # 前端邏輯（AJAX + 矩陣渲染）
└── README.md
```

## 最終 MDP 設定摘要

| 參數 | 值 |
|---|---|
| 折扣因子 γ | 0.9 |
| 收斂閾值 θ | 0.0001 |
| 終點獎勵 | +10（V(goal) = 10） |
| 障礙物懲罰 | −10（留在原地） |
| 一般移動 | −1 |
| 行為空間 | ↑ ↓ ← →（tie-break: 上>下>左>右） |
| 終點 V(s) | 10.00 |
| 障礙物 V(s) | 0.00 |
