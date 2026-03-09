constraint forall(r in 1..rows+1, c in 1..cols+1)(
    bool2int(if c > 1 then border_h[r, c-1] else false endif)
    + bool2int(if c <= cols then border_h[r, c] else false endif)
    + bool2int(if r > 1 then border_v[r-1, c] else false endif)
    + bool2int(if r <= rows then border_v[r, c] else false endif)
    = 2
);
