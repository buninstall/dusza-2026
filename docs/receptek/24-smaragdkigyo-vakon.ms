set talalt to 0
set kell to 12
set megy to true
while megy
    turn by 3
    set fal to isThere 1
    while fal
        turn by 1
        set fal to isThere 1
    set arany to isThere 2
    step forward 1
    if arany
        mine here
        set talalt to talalt + 1
    set megy to talalt < kell
