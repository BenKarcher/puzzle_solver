% Enforce same shading on adjacent cells that share a region.
% Transitivity through connected regions ensures all same-region cells agree.
constraint forall(r in 1..rows, c in 1..cols-1)(
    region[r,c] = region[r,c+1] -> shaded[r,c] = shaded[r,c+1]
);
constraint forall(r in 1..rows-1, c in 1..cols)(
    region[r,c] = region[r+1,c] -> shaded[r,c] = shaded[r+1,c]
);
