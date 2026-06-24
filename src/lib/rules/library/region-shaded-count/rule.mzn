predicate region_shaded_count(array[int] of var bool: shading, int: target) =
    sum(s in shading)(bool2int(s)) = target;
