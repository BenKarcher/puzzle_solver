function array[int] of var int: ortho_neighbor_digits(int: r, int: c) =
    [digits[r + dr, c + dc] | dr in -1..1, dc in -1..1
     where abs(dr) + abs(dc) = 1 /\ r + dr >= 1 /\ r + dr <= rows /\ c + dc >= 1 /\ c + dc <= cols];

function array[int] of var int: ortho_neighbor_values(int: r, int: c) =
    [values[r + dr, c + dc] | dr in -1..1, dc in -1..1
     where abs(dr) + abs(dc) = 1 /\ r + dr >= 1 /\ r + dr <= rows /\ c + dc >= 1 /\ c + dc <= cols];

function array[int] of var int: king_neighbor_digits(int: r, int: c) =
    [digits[r + dr, c + dc] | dr in -1..1, dc in -1..1
     where (dr != 0 \/ dc != 0) /\ r + dr >= 1 /\ r + dr <= rows /\ c + dc >= 1 /\ c + dc <= cols];

function array[int] of var int: king_neighbor_values(int: r, int: c) =
    [values[r + dr, c + dc] | dr in -1..1, dc in -1..1
     where (dr != 0 \/ dc != 0) /\ r + dr >= 1 /\ r + dr <= rows /\ c + dc >= 1 /\ c + dc <= cols];
