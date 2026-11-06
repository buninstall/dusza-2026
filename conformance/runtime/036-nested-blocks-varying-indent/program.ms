set i to 0
set go to true
while go
  set i to i + 1
  set odd to i = 1
  if odd
       print i
  else
      set big to i > 2
      if big
       print 100
      else
                print 0
  set go to i < 3
print i