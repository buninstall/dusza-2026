set kor to 0
set hossz to 2
set megy to kor < 4
while megy
    step forward hossz
    mine here
    set kor to kor + 1
    set megy to kor < 4
set pont to kor * 25
print pont
set maradt to 4 - kor
print maradt
set tele to kor >= 4
print tele
set ures to kor <= 0
print ures
set tobb to pont > 99
print tobb
