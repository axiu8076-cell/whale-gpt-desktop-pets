"""Build on Apple Silicon macOS; ditto preserves Electron framework symlinks."""
from pathlib import Path
import argparse, hashlib, json, os, platform, plistlib, shutil, subprocess, urllib.request, zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = '44.3.0'
NAME = 'Whale-Standalone-macOS-arm64-2026.10.16'

def run(*args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, **kwargs)

def sha(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def build(output):
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise SystemExit('Build this package on an Apple Silicon Mac (macOS 14+).')
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    stage = output / NAME
    if stage.exists():
        raise SystemExit('Output already exists; choose a fresh output directory.')
    stage.mkdir()
    cache = output / 'electron-download'
    cache.mkdir(exist_ok=True)
    base = f'https://github.com/electron/electron/releases/download/v{VERSION}/'
    archive = cache / f'electron-v{VERSION}-darwin-arm64.zip'
    sums = urllib.request.urlopen(base + 'SHASUMS256.txt', timeout=90).read().decode()
    expected = next(line.split()[0] for line in sums.splitlines() if line.split()[-1].lstrip('*') == archive.name)
    urllib.request.urlretrieve(base + archive.name, archive)
    if sha(archive) != expected:
        raise SystemExit('Electron SHA256 mismatch')
    runtime = output / 'electron-runtime'
    run('/usr/bin/ditto', '-x', '-k', archive, runtime)
    app = stage / '鲸鲸.app'
    shutil.copytree(runtime / 'Electron.app', app, symlinks=True)
    resources = app / 'Contents/Resources'
    (resources / 'default_app.asar').unlink(missing_ok=True)
    source = resources / 'app'
    shutil.copytree(ROOT / 'src/whale', source)
    package = json.loads((source / 'package.json').read_text())
    package.update(name='whale-companion', productName='鲸鲸', version='2026.10.16', main='desktop/macos/entry.cjs')
    (source / 'package.json').write_text(json.dumps(package, ensure_ascii=False, indent=2))
    for name in ('LICENSE', 'LICENSES.chromium.html', 'version'):
        if (runtime / name).exists():
            shutil.copy2(runtime / name, resources / name)
    plist_path = app / 'Contents/Info.plist'
    with plist_path.open('rb') as file:
        plist = plistlib.load(file)
    plist.update(CFBundleIdentifier='io.github.axiu8076.whale', CFBundleName='WhaleCompanion', CFBundleDisplayName='鲸鲸',
                 CFBundleShortVersionString='2026.10.16', CFBundleVersion='2026.10.16.2', LSUIElement=True, LSMinimumSystemVersion='14.0')
    with plist_path.open('wb') as file:
        plistlib.dump(plist, file)
    # Helpers must have unique bundle identities after renaming the outer app.
    for file in (app / 'Contents/Frameworks').glob('*.app/Contents/Info.plist'):
        with file.open('rb') as stream:
            helper = plistlib.load(stream)
        helper['CFBundleIdentifier'] = 'io.github.axiu8076.whale.' + file.parents[1].stem.replace(' ', '').replace('(', '').replace(')', '')
        with file.open('wb') as stream:
            plistlib.dump(helper, stream)
    (source / 'bin').mkdir(exist_ok=True)
    run('/usr/bin/xcrun', 'swiftc', '-O', '-target', 'arm64-apple-macos14.0', source / 'desktop/macos/window-probe.swift', '-o', source / 'bin/window-probe')
    run('/usr/bin/codesign', '--force', '--deep', '--sign', '-', '--options', 'runtime', '--entitlements', ROOT / 'installer/macos/entitlements.plist', app)
    run('/usr/bin/codesign', '--verify', '--deep', '--strict', app)
    run('/usr/bin/lipo', '-verify_arch', 'arm64', app / 'Contents/MacOS/Electron')
    for file in source.rglob('*'):
        if file.is_file() and (file.suffix in ('.jsonl', '.sqlite', '.db', '.log') or file.name.startswith('.env') or file.name in ('api-key.encrypted', 'auth.json', 'runtime.json', 'api-settings.json')):
            raise SystemExit('Forbidden personal/runtime file in package: ' + str(file.relative_to(source)))
    shutil.copy2(ROOT / 'installer/macos/使用说明.txt', stage)
    shutil.copy2(ROOT / 'LICENSE', stage / 'LICENSE.txt')
    (stage / 'BUILD-INFO.json').write_text(json.dumps({'platform':'darwin','arch':'arm64','electron':VERSION,'electronSha256':expected,'minimumMacOS':'14.0','signature':'ad-hoc; not notarized'}, indent=2))
    # Real Electron smoke test runs with disposable data before the archive is produced.
    env = {**os.environ, 'ELECTRON_RUN_AS_NODE':'1'}
    run(app / 'Contents/MacOS/Electron', '--test', ROOT / 'tools/tests/macos.test.mjs', env=env)
    run(app / 'Contents/MacOS/Electron', ROOT / 'tools/test-macos-app.mjs', app, output / 'macos-validation.json', env=env, timeout=150)
    result = output / (NAME + '.zip')
    run('/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', stage, result)
    with zipfile.ZipFile(result) as archive_test:
        assert archive_test.testzip() is None
        links = [entry for entry in archive_test.infolist() if (entry.external_attr >> 16) & 0o170000 == 0o120000]
        assert links, 'Framework symlinks were lost'
    (output / 'SHA256SUMS-macOS-arm64.txt').write_text(sha(result) + '  ' + result.name + '\n')
    print(json.dumps({'archive':str(result),'sha256':sha(result),'bytes':result.stat().st_size}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    build(parser.parse_args().output)
