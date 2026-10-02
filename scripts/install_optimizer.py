from pathlib import Path
p=Path('index.html');s=p.read_text()
if 'src="./optimizer.js"' not in s:
    if '</body>' not in s:raise RuntimeError('Site layout missing body closing tag')
    s=s.replace('</body>','<script src="./optimizer.js"></script></body>',1)
    p.write_text(s)
