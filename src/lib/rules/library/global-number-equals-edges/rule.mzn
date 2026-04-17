constraint forall(r in 1..rows, c in 1..cols)(
    values[r, c] = bool2int(border_h[r, c]) + bool2int(border_h[r + 1, c]) + bool2int(border_v[r, c]) + bool2int(border_v[r, c + 1])
);