constraint forall(r in 1..rows, c in 1..cols)(
    sum(king_neighbor_values(r, c)) mod values[r, c] = 0
);
