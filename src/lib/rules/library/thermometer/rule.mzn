predicate thermometer(array[int] of var int: cells) =
    forall(i in 1..length(cells)-1)(cells[i] < cells[i+1]);
