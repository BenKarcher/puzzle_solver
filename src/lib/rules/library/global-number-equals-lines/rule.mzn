constraint forall(r in 1..rows, c in 1..cols)(
    values[r, c] = 
        if c > 1 then line_h[r, c - 1] else 0 endif +
        if c < cols then line_h[r, c] else 0 endif +
        if r > 1 then line_v[r - 1, c] else 0 endif +
        if r < rows then line_v[r, c] else 0 endif
);