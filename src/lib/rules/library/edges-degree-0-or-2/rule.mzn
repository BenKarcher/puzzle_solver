predicate edges_degree_0_or_2(array[int,int] of var bool: border_h, array[int,int] of var bool: border_v) =
    forall(r in 1..rows+1, c in 1..cols+1)(
        let { var int: deg =
            bool2int(if c > 1 then border_h[r, c-1] else false endif)
            + bool2int(if c <= cols then border_h[r, c] else false endif)
            + bool2int(if r > 1 then border_v[r-1, c] else false endif)
            + bool2int(if r <= rows then border_v[r, c] else false endif)
        } in deg = 0 \/ deg = 2
    );
