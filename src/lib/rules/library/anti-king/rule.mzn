constraint forall(r in 1..rows, c in 1..cols, dr in -1..1, dc in -1..1 where
    not (dr = 0 /\ dc = 0) /\
    (dr > 0 \/ (dr = 0 /\ dc > 0)) /\
    r + dr >= 1 /\ r + dr <= rows /\
    c + dc >= 1 /\ c + dc <= cols
)(
    grid[r, c] != grid[r + dr, c + dc]
);
