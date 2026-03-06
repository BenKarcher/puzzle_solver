# sudoku global
- diagonal_plus (no repeated numpers on the up right diagonal)
- diagonal_minus (no repeated numpers on the up left diagonal)
- anti_knight (no repeated numpers on the knight move)
- anti_king (no repeated numpers on the king move (make sure to also include horizontal and vertical even though sudoku covers them this may be used without sudoku rules))
- non_consecutive (no repeated numpers on the orthogonally adjacent cells) (please include a warning in the descriptionthat this is different from negative kropki)
- disjoint groups (no repeated numbers in the same position in different boxes (use order of cells to determine this, so for example the third instance of every region ID would be in the same disjoint group))

- extra region (like a cage but without a sum)
- odd: the given cell(s) must be odd (renders as a grey circle background)
- even: the given cell(s) must be even (renders as a grey square background)
- thermometer: a chain of cells where numbers must strictly increase (rendered with a thermometer background)
- arrow: a bulb (group 1) with an arrow (group 2) leaving it, the numbers in group 2 must sum up to group 1 read as a base 10 number include a warning that the bulb is read in the selected order