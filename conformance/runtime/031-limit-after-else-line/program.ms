set n to 100 * 3
set n to n + 31
set i to 0
set go to true
while go
    set i to i + 1
    set go to i < n
if go
    print 1
else
    print i