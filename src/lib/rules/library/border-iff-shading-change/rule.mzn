predicate border_iff_shading_change(array[int,int] of var bool: shaded, array[int,int] of var bool: border_h, array[int,int] of var bool: border_v) =
    % Interior horizontal borders: between cell (r-1,c) and cell (r,c), r in 2..rows
    forall(r in 2..rows, c in 1..cols)(
        border_h[r,c] = (shaded[r-1,c] != shaded[r,c])
    ) /\
    % Interior vertical borders: between cell (r,c-1) and cell (r,c), c in 2..cols
    forall(r in 1..rows, c in 2..cols)(
        border_v[r,c] = (shaded[r,c-1] != shaded[r,c])
    );
