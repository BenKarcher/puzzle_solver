% Orthogonal / king-move neighbor values of cell (r, c) in the given grid.
function array[int] of var int: ortho_neighbors(array[int,int] of var int: grid, int: r, int: c) =
    [grid[r + dr, c + dc] | dr in -1..1, dc in -1..1
     where abs(dr) + abs(dc) = 1 /\ r + dr >= 1 /\ r + dr <= rows /\ c + dc >= 1 /\ c + dc <= cols];

function array[int] of var int: king_neighbors(array[int,int] of var int: grid, int: r, int: c) =
    [grid[r + dr, c + dc] | dr in -1..1, dc in -1..1
     where (dr != 0 \/ dc != 0) /\ r + dr >= 1 /\ r + dr <= rows /\ c + dc >= 1 /\ c + dc <= cols];
