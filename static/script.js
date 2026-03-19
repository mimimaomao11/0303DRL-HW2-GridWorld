let gridSize = 4
let start = null
let end = null
let obstacles = []

const ARROWS = ["↑", "↓", "←", "→"]

// ─── Grid Creation ─────────────────────────────────────────────────────────

function createGrid() {
    gridSize = parseInt(document.getElementById("size").value)
    if (isNaN(gridSize) || gridSize < 3 || gridSize > 10) {
        alert("Please enter a number between 3 and 10.")
        return
    }

    start = null
    end = null
    obstacles = []

    const grid = document.getElementById("grid")
    grid.innerHTML = ""
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 70px)`

    for (let i = 0; i < gridSize * gridSize; i++) {
        const cell = document.createElement("div")
        cell.className = "cell"
        cell.dataset.index = i
        cell.textContent = i + 1
        cell.onclick = () => cellClick(cell)
        grid.appendChild(cell)
    }

    // Clear value grid and pre-fill random policy
    document.getElementById("valueGrid").innerHTML = ""
    showRandomPolicy()
}


// ─── Cell Click Logic ──────────────────────────────────────────────────────

function cellClick(cell) {
    const index = parseInt(cell.dataset.index)
    const r = Math.floor(index / gridSize)
    const c = index % gridSize

    // Toggle off start
    if (start && start[0] === r && start[1] === c) {
        start = null
        cell.className = "cell"
        cell.textContent = index + 1
        return
    }

    // Toggle off end
    if (end && end[0] === r && end[1] === c) {
        end = null
        cell.className = "cell"
        cell.textContent = index + 1
        return
    }

    // Toggle off obstacle
    const obsIdx = obstacles.findIndex(o => o[0] === r && o[1] === c)
    if (obsIdx !== -1) {
        obstacles.splice(obsIdx, 1)
        cell.className = "cell"
        cell.textContent = index + 1
        return
    }

    // 1st click → start
    if (!start) {
        start = [r, c]
        cell.className = "cell start"
        cell.textContent = "S"
        return
    }

    // 2nd click → end
    if (!end) {
        end = [r, c]
        cell.className = "cell end"
        cell.textContent = "E"
        return
    }

    // Subsequent clicks → obstacles  (limit: n−2, re-evaluated from current gridSize)
    const maxObs = gridSize - 2
    if (obstacles.length >= maxObs) {
        alert(`Maximum ${maxObs} obstacles allowed for a ${gridSize}×${gridSize} grid.`)
        return
    }

    obstacles.push([r, c])
    cell.className = "cell obstacle"
    cell.textContent = ""
}


// ─── Reset ─────────────────────────────────────────────────────────────────

function resetGrid() {
    // createGrid already resets start/end/obstacles and clears matrices
    createGrid()
}


// ─── Random Policy (pre-compute placeholder) ───────────────────────────────

function showRandomPolicy() {
    const grid = document.getElementById("policyGrid")
    grid.innerHTML = ""
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 70px)`

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cell = document.createElement("div")

            const isObs   = obstacles.some(o => o[0] === r && o[1] === c)
            const isEnd   = end   && end[0] === r && end[1] === c
            const isStart = start && start[0] === r && start[1] === c

            if (isObs) {
                cell.className = "cell obstacle"
                cell.textContent = ""
            } else if (isEnd) {
                cell.className = "cell end"
                cell.textContent = "G"
            } else if (isStart) {
                cell.className = "cell start"
                cell.textContent = ARROWS[Math.floor(Math.random() * ARROWS.length)]
            } else {
                cell.className = "cell"
                cell.textContent = ARROWS[Math.floor(Math.random() * ARROWS.length)]
            }

            grid.appendChild(cell)
        }
    }
}


// ─── Compute (AJAX) ────────────────────────────────────────────────────────

async function compute() {
    // Ensure latest gridSize from the input is used
    gridSize = parseInt(document.getElementById("size").value)

    if (!start) {
        alert("Please set a Start cell.")
        return
    }
    if (!end) {
        alert("Please set an End cell.")
        return
    }
    // Read optional numerical parameters from the UI
    let gamma = parseFloat(document.getElementById("gamma")?.value)
    if (isNaN(gamma)) gamma = 0.9
    let theta = parseFloat(document.getElementById("theta")?.value)
    if (isNaN(theta)) theta = 0.0001

    try {
        const res = await fetch("/compute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                n: gridSize,
                obstacles: obstacles,
                start: start,
                end: end,
                gamma: gamma,
                theta: theta
            })
        })

        if (!res.ok) {
            // try to get error message from server
            let text = await res.text()
            throw new Error(`Server error ${res.status}: ${text}`)
        }

        const data = await res.json()

        // Trace path from start following policy arrows until reaching end
        const P = data.p_matrix
        const startPos = start
        const endPos = data.end
        const path = []
        if (startPos && P && Array.isArray(P)) {
            const visited = new Set()
            let r = startPos[0], c = startPos[1]
            for (let i = 0; i < gridSize * gridSize; i++) {
                path.push([r, c])
                const key = `${r}_${c}`
                if (visited.has(key)) break
                visited.add(key)

                // If reached end, stop
                if (endPos && r === endPos[0] && c === endPos[1]) break

                const val = P[r] ? P[r][c] : null
                if (!val) break
                if (val === "G" || val === "X") break

                const moves = {"↑": [-1, 0], "↓": [1, 0], "←": [0, -1], "→": [0, 1]}
                const mv = moves[val]
                if (!mv) break
                const nr = r + mv[0]
                const nc = c + mv[1]
                if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) break
                // stop if next is obstacle (use client obstacle list)
                const nextIsObs = obstacles.some(o => o[0] === nr && o[1] === nc)
                if (nextIsObs) break

                r = nr; c = nc
            }
        }

        renderValueMatrix(data.v_matrix, data.start, data.end, path)
        renderPolicyMatrix(data.p_matrix, data.start, data.end, path)
    } catch (err) {
        alert("計算失敗：" + err.message)
    }
}


// ─── Value Matrix ──────────────────────────────────────────────────────────

function renderValueMatrix(V, startPos, endPos, path=[]) {
    const grid = document.getElementById("valueGrid")
    grid.innerHTML = ""
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 70px)`

    const pathSet = new Set(path.map(p => `${p[0]}_${p[1]}`))

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cell = document.createElement("div")
            const isObs   = obstacles.some(o => o[0] === r && o[1] === c)
            const isStart = startPos && startPos[0] === r && startPos[1] === c
            const isEnd   = endPos   && endPos[0]   === r && endPos[1]   === c
            const inPath  = pathSet.has(`${r}_${c}`)

            const classes = ["cell"]
            if (isObs) classes.push("obstacle")
            if (isStart) classes.push("start")
            if (isEnd) classes.push("end")
            if (inPath) classes.push("path")

            cell.className = classes.join(" ")

            if (isObs) {
                cell.textContent = ""
            } else {
                cell.textContent = V[r][c].toFixed(2)
            }

            grid.appendChild(cell)
        }
    }
}


// ─── Policy Matrix ─────────────────────────────────────────────────────────

function renderPolicyMatrix(P, startPos, endPos, path=[]) {
    const grid = document.getElementById("policyGrid")
    grid.innerHTML = ""
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 70px)`

    const pathSet = new Set(path.map(p => `${p[0]}_${p[1]}`))

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            const cell = document.createElement("div")
            const val     = P[r][c]
            const isObs   = val === "X"
            const isGoal  = val === "G" || (endPos && endPos[0] === r && endPos[1] === c)
            const isStart = startPos && startPos[0] === r && startPos[1] === c
            const inPath  = pathSet.has(`${r}_${c}`)

            const classes = ["cell"]
            if (isObs) classes.push("obstacle")
            if (isStart) classes.push("start")
            if (isGoal) classes.push("end")
            if (inPath) classes.push("path")
            cell.className = classes.join(" ")

            if (isObs) {
                cell.textContent = ""
            } else if (isGoal) {
                cell.textContent = "G"
            } else {
                cell.textContent = val
            }

            grid.appendChild(cell)
        }
    }
}


// ─── Init ──────────────────────────────────────────────────────────────────

createGrid()