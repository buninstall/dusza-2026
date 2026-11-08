set talalt to 0
set kesz to false
set fut to not kesz
while fut
    set arany to isThere 2
    set ures to isThere 0
    set mehet to arany or ures
    if mehet
        step forward 1
        if arany
            mine here
            set talalt to talalt + 1
    set eleg to talalt = 3
    set fal to isThere 1
    set kesz to eleg or fal
    set fut to not kesz
set mind to eleg and fal
print mind
set mas to talalt <> 2
print mas
set igaz to true
print igaz
