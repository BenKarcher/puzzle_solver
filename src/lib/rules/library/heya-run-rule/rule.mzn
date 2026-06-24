constraint forall(r in 1..rows, c1 in 1..cols-2, c2 in c1+2..cols where
       region[r,c1]   != region[r,c1+1]                        % left boundary
    /\ region[r,c2]   != region[r,c2-1]                        % right boundary
    /\ forall(c in c1+1..c2-2)(region[r,c] == region[r,c1+1])  % middle is one region
)(
    exists(c in c1..c2)(shaded[r,c])
);
constraint forall(c in 1..cols, r1 in 1..rows-2, r2 in r1+2..rows where
       region[r1,c]   != region[r1+1,c]                        % top boundary
    /\ region[r2,c]   != region[r2-1,c]                        % bottom boundary
    /\ forall(r in r1+1..r2-2)(region[r,c] == region[r1+1,c])  % middle is one region
)(
    exists(r in r1..r2)(shaded[r,c])
);