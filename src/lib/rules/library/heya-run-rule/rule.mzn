constraint forall(r in 1..rows, c1 in 1..cols-2, c2 in c1+2..cols where
       region[r,c1]   != region[r,c1+1]                        % left boundary
    /\ region[r,c2]   != region[r,c2-1]                        % right boundary
    /\ forall(c in c1+1..c2-1)(region[r,c] == region[r,c1+1])  % middle is one region
)(
    % ... your constraint over cells region[r, c1..c2] ...
);