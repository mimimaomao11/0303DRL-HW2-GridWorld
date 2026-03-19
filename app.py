from flask import Flask, render_template, request, jsonify
import numpy as np

app = Flask(__name__)


def value_iteration(n, obstacles, terminal, gamma=0.9, theta=0.0001):
    """
    MDP parameters:
      - Reward: +10 reaching goal, -10 bumping obstacle (stay in place), -1 per step
      - Gamma:  γ (discount factor), default 0.9
      - Theta:  convergence threshold, default 0.0001
      - Actions: Up, Down, Left, Right (priority order for tie-breaking)

    Note: `start` is intentionally not used by the value iteration routine.
    The function computes the full V and policy for the grid given `n`,
    `obstacles`, `terminal`, and numerical parameters `gamma`/`theta`.

    Implementation detail (reward semantics): when an action would move into an
    obstacle the implementation gives reward = -10 and keeps the agent in the
    same cell (next_state = s). As a result the Bellman update for that action
    becomes: Q = -10 + γ * V(s). This uses the *previous* V(s) for the RHS
    (standard value iteration), which is intentionally self-referential but
    numerically well-defined. If you prefer a different semantics (for
    example, give -10 but transition to an explicit 'penalised' state), adapt
    the reward/transition model accordingly.
    """

    # Action order defines tie-breaking priority: Up > Down > Left > Right
    actions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    arrows  = ["↑",    "↓",    "←",    "→"]

    obstacle_set = set(tuple(o) for o in obstacles)
    term = tuple(terminal)

    # Initialize V: obstacles stay 0, terminal starts at 0
    V = np.zeros((n, n))
    policy = [["" for _ in range(n)] for _ in range(n)]

    # Pre-mark terminal and obstacles in policy
    for o in obstacles:
        policy[o[0]][o[1]] = "X"
    policy[term[0]][term[1]] = "G"

    while True:
        delta = 0
        newV = V.copy()

        for r in range(n):
            for c in range(n):
                state = (r, c)

                # Obstacles: fixed at 0, skip
                if state in obstacle_set:
                    newV[r][c] = 0.0
                    continue

                # Terminal (absorbing state): V = reward of being here
                # Bellman for absorbing state: V(s) = R(s)  →  converges to 10
                if state == term:
                    newV[r][c] = 10.0
                    continue

                q_values = []
                for dr, dc in actions:
                    nr = r + dr
                    nc = c + dc

                    # Hit wall → stay
                    if nr < 0 or nr >= n or nc < 0 or nc >= n:
                        nr, nc = r, c

                    next_state = (nr, nc)

                    # Hit obstacle → stay, reward -10
                    if next_state in obstacle_set:
                        reward = -10
                        nr, nc = r, c
                    else:
                        # Normal step cost (-1) for ALL transitions including to goal.
                        # V(goal) is pinned at 10, so we do NOT add +10 reward again
                        # here — that would double-count and inflate all values.
                        # Correct Bellman: Q(s→goal) = -1 + γ×V(goal) = -1+0.9×10 = 8
                        reward = -1

                    q_values.append(reward + gamma * V[nr][nc])

                # np.argmax returns FIRST index when tied → respects Up > Down > Left > Right
                best = int(np.argmax(q_values))
                newV[r][c] = q_values[best]
                policy[r][c] = arrows[best]

                delta = max(delta, abs(newV[r][c] - V[r][c]))

        V = newV

        if delta < theta:
            break

    # Finalise special cells
    for o in obstacles:
        policy[o[0]][o[1]] = "X"
    policy[term[0]][term[1]] = "G"

    # Obstacle cells in V stay 0.0 (already initialised to 0 and never updated)

    return V.tolist(), policy


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/compute", methods=["POST"])
def compute():
    data      = request.json
    n         = data["n"]
    obstacles = data["obstacles"]
    terminal  = data["end"]
    start     = data.get("start")

    # --- Input validation ---
    # Validate n
    try:
        n = int(n)
    except Exception:
        return jsonify({"error": "Invalid grid size 'n'"}), 400
    if n <= 0 or n > 100:
        return jsonify({"error": "Grid size 'n' out of allowed range"}), 400

    # Validate obstacles
    if not isinstance(obstacles, list):
        return jsonify({"error": "Invalid 'obstacles' format"}), 400
    # Normalize obstacle set and validate coords
    obs_set = set()
    for o in obstacles:
        if (not isinstance(o, (list, tuple))) or len(o) != 2:
            return jsonify({"error": "Invalid obstacle coordinate"}), 400
        try:
            r, c = int(o[0]), int(o[1])
        except Exception:
            return jsonify({"error": "Invalid obstacle coordinate types"}), 400
        if r < 0 or r >= n or c < 0 or c >= n:
            return jsonify({"error": "Obstacle coordinate out of bounds"}), 400
        obs_set.add((r, c))

    # Validate terminal
    if (not isinstance(terminal, (list, tuple))) or len(terminal) != 2:
        return jsonify({"error": "Invalid 'end' coordinate"}), 400
    try:
        tr, tc = int(terminal[0]), int(terminal[1])
    except Exception:
        return jsonify({"error": "Invalid 'end' coordinate types"}), 400
    if tr < 0 or tr >= n or tc < 0 or tc >= n:
        return jsonify({"error": "End coordinate out of bounds"}), 400

    # Validate start (if provided)
    if start is None:
        start = None
    else:
        if (not isinstance(start, (list, tuple))) or len(start) != 2:
            return jsonify({"error": "Invalid 'start' coordinate"}), 400
        try:
            sr, sc = int(start[0]), int(start[1])
        except Exception:
            return jsonify({"error": "Invalid 'start' coordinate types"}), 400
        if sr < 0 or sr >= n or sc < 0 or sc >= n:
            return jsonify({"error": "Start coordinate out of bounds"}), 400

    # Ensure start/end are not obstacles
    if (tr, tc) in obs_set:
        return jsonify({"error": "End coordinate is inside an obstacle"}), 400
    if start is not None and (sr, sc) in obs_set:
        return jsonify({"error": "Start coordinate is inside an obstacle"}), 400

    # Limit obstacles to reasonable maximum (leave space for start & end)
    if len(obs_set) > n * n - 2:
        return jsonify({"error": "Too many obstacles"}), 400

    # Convert obstacles back to list of lists for internal usage ordering
    obstacles = [list(o) for o in obs_set]

    # Read optional numerical parameters
    try:
        gamma = float(data.get("gamma", 0.9))
    except Exception:
        return jsonify({"error": "Invalid 'gamma' value"}), 400
    if gamma < 0 or gamma > 1:
        return jsonify({"error": "'gamma' must be between 0 and 1"}), 400

    try:
        theta = float(data.get("theta", 0.0001))
    except Exception:
        return jsonify({"error": "Invalid 'theta' value"}), 400
    if theta <= 0:
        return jsonify({"error": "'theta' must be > 0"}), 400

    V, policy = value_iteration(n, obstacles, terminal, gamma=gamma, theta=theta)

    return jsonify({
        "v_matrix": V,
        "p_matrix": policy,
        "start":    start,
        "end":      terminal
    })


if __name__ == "__main__":
    app.run(debug=False)