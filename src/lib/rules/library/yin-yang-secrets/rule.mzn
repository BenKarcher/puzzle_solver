% ── Yin-Yang Secrets ──────────────────────────────────────────────────────────
% Derived constraints that hold for every valid Yin-Yang solution.
% They add no new logical meaning but dramatically prune the search space.
predicate yin_yang_secrets(array[int,int] of var bool: shaded) =
    let {
        % Number of colour transitions around the border cycle
        var int: transitions =
            sum(c in 1..cols-1)(bool2int(shaded[1,c]     != shaded[1,c+1])) +
            sum(r in 1..rows-1)(bool2int(shaded[r,cols]   != shaded[r+1,cols])) +
            sum(c in 1..cols-1)(bool2int(shaded[rows,c]   != shaded[rows,c+1])) +
            sum(r in 1..rows-1)(bool2int(shaded[r,1]      != shaded[r+1,1]));
    } in
    % 1. No 2×2 checkerboard
    forall(r in 1..rows-1, c in 1..cols-1)(
        not (shaded[r,c] != shaded[r,c+1] /\
             shaded[r,c]  = shaded[r+1,c+1] /\
             shaded[r,c+1] = shaded[r+1,c])
    ) /\
    % 2. Border: at most 2 colour transitions (mono or exactly 2 arcs)
    transitions <= 2 /\
    % 3. Odd side length: unshaded edge-cell count parity
    (if rows mod 2 = 1 \/ cols mod 2 = 1 then
        transitions = 0 \/
        (  sum(c in 2..cols-1)(bool2int(not shaded[1,c]))
         + sum(r in 2..rows-1)(bool2int(not shaded[r,cols]))
         + sum(c in 2..cols-1)(bool2int(not shaded[rows,c]))
         + sum(r in 2..rows-1)(bool2int(not shaded[r,1]))
        ) mod 2 = 1
    else true endif) /\
    % 4. Even×even: forced two-colour split + domino pairing of edge cells
    (if rows mod 2 = 0 /\ cols mod 2 = 0 then
        transitions = 2 /\
        forall(i in 1..(cols-2) div 2)(shaded[1, 2*i]   = shaded[1, 2*i+1])   /\ % top
        forall(i in 1..(cols-2) div 2)(shaded[rows, 2*i] = shaded[rows, 2*i+1]) /\ % bottom
        forall(i in 1..(rows-2) div 2)(shaded[2*i, cols] = shaded[2*i+1, cols]) /\ % right
        forall(i in 1..(rows-2) div 2)(shaded[2*i, 1]    = shaded[2*i+1, 1])       % left
    else true endif);
