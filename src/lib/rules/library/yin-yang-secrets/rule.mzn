% ── Yin-Yang Secrets ──────────────────────────────────────────────────────────
% Derived constraints that hold for every valid Yin-Yang solution.
% They add no new logical meaning but dramatically prune the search space.

% Helper: number of colour transitions around the border cycle.
% Counts adjacent pairs (top / right / bottom / left sides) that differ.
var int: yys_border_transitions =
    sum(c in 1..cols-1)(bool2int(shaded[1,c]     != shaded[1,c+1])) +
    sum(r in 1..rows-1)(bool2int(shaded[r,cols]   != shaded[r+1,cols])) +
    sum(c in 1..cols-1)(bool2int(shaded[rows,c]   != shaded[rows,c+1])) +
    sum(r in 1..rows-1)(bool2int(shaded[r,1]      != shaded[r+1,1]));

% ── 1. No 2×2 checkerboard ────────────────────────────────────────────────────
% A 2×2 block cannot alternate colours (top-left = bottom-right ≠ top-right = bottom-left).
constraint forall(r in 1..rows-1, c in 1..cols-1)(
    not (shaded[r,c] != shaded[r,c+1] /\
         shaded[r,c]  = shaded[r+1,c+1] /\
         shaded[r,c+1] = shaded[r+1,c])
);

% ── 2. Border: at most 2 colour transitions ────────────────────────────────────
% The border cells form a cycle; a valid Yin-Yang border is either
% monochromatic (0 transitions) or splits into exactly 2 arcs (2 transitions).
constraint yys_border_transitions <= 2;

% ── 3. Odd side length: edge-cell colour count parity ─────────────────────────
% When at least one grid dimension is odd and the border is not monochromatic,
% the count of unshaded (white) edge cells must be odd.
% (Edge cells = non-corner border cells.  Since the total edge count is always
%  even, the shaded count is then also odd automatically.)
constraint if rows mod 2 = 1 \/ cols mod 2 = 1 then
    yys_border_transitions = 0 \/
    (  sum(c in 2..cols-1)(bool2int(not shaded[1,c]))
     + sum(r in 2..rows-1)(bool2int(not shaded[r,cols]))
     + sum(c in 2..cols-1)(bool2int(not shaded[rows,c]))
     + sum(r in 2..rows-1)(bool2int(not shaded[r,1]))
    ) mod 2 = 1
else true endif;

% ── 4. Even×even: forced two-colour split + domino pairing ────────────────────
% When both dimensions are even the border cannot be monochromatic.
% Additionally, edge cells pair into adjacent dominoes, each wholly one colour
% (i.e. the colour split always occurs between pairs, never inside a pair).
constraint if rows mod 2 = 0 /\ cols mod 2 = 0 then
    yys_border_transitions = 2 /\
    forall(i in 1..(cols-2) div 2)(shaded[1, 2*i]   = shaded[1, 2*i+1])   /\ % top
    forall(i in 1..(cols-2) div 2)(shaded[rows, 2*i] = shaded[rows, 2*i+1]) /\ % bottom
    forall(i in 1..(rows-2) div 2)(shaded[2*i, cols] = shaded[2*i+1, cols]) /\ % right
    forall(i in 1..(rows-2) div 2)(shaded[2*i, 1]    = shaded[2*i+1, 1])       % left
else true endif;
