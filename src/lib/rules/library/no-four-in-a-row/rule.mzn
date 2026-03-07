% No 4 in a Row
% No 4 consecutive cells in a row or column may all be shaded or all be unshaded.

% Horizontal runs of 4
constraint forall(r in 1..rows, c in 1..cols-3)(
  let { var int: s = bool2int(shaded[r, c]) + bool2int(shaded[r, c+1]) + bool2int(shaded[r, c+2]) + bool2int(shaded[r, c+3]) } in
  s != 0 /\ s != 4
);

% Vertical runs of 4
constraint forall(r in 1..rows-3, c in 1..cols)(
  let { var int: s = bool2int(shaded[r, c]) + bool2int(shaded[r+1, c]) + bool2int(shaded[r+2, c]) + bool2int(shaded[r+3, c]) } in
  s != 0 /\ s != 4
);
