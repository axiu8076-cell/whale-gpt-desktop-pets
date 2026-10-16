"""Build Windows packages from this repository and an unpacked Electron 44.3.0 runtime."""
from pathlib import Path
import argparse, hashlib, json, shutil, zipfile
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--electron-dir',type=Path,required=True)
p.add_argument('--variant',choices=['whale','duo'],required=True)
p.add_argument('--output',type=Path,default=Path('dist'))
a=p.parse_args();repo=Path(__file__).resolve().parents[1]
runtime=a.electron_dir.resolve()
assert (runtime/'electron.exe').is_file() and (runtime/'LICENSE').is_file() and (runtime/'LICENSES.chromium.html').is_file()
assert (runtime/'version').read_text().strip()=='44.3.0','Expected Electron 44.3.0 Windows x64'
name='Whale-'+('Standalone' if a.variant=='whale' else 'GPT-Duo')+'-Windows-x64-2026.10.16'
target=a.output.resolve()/name
assert not target.exists(),'Use an empty output directory'
payload=target/'payload';payload.mkdir(parents=True)
shutil.copytree(repo/'src/whale',payload/'app')
if a.variant=='duo':
    shutil.copytree(repo/'src/gpt',payload/'app-gpt')
    panel=payload/'app/desktop/ui/duo-catalog.js'
    panel.write_text(panel.read_text(encoding='utf8').replace("textContent='鲸鲸生活助手'","textContent='鲸鲸 × GPT 娘'"),encoding='utf8')
shutil.copytree(runtime,payload/'runtime')
installer=repo/'installer'/a.variant
for file in installer.rglob('*'):
    if not file.is_file():continue
    rel=file.relative_to(installer);dest=target/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,dest)
manifest={'product':'whale-companion-standalone','variant':a.variant,'version':'2026.10.16.1','files':[{'path':f.relative_to(payload).as_posix(),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(payload.rglob('*')) if f.is_file()]}
(target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
archive=a.output.resolve()/(name+'.zip')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for file in sorted(target.rglob('*')):
        if file.is_file():z.write(file,arcname=name+'/'+file.relative_to(target).as_posix())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
(archive.with_suffix('.zip.sha256')).write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n',encoding='ascii')
print(archive)
