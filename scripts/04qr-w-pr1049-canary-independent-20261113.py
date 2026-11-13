"""Independent QA-only audit of actual static build, no managed deployment."""
import hashlib, io, pathlib, subprocess, zipfile, struct, tempfile, threading, functools, http.server, urllib.request, urllib.error
from PIL import Image
S='e7ef599a1ec524374ad079618e37bfb1e0bb3be0'
B='a81c591f18a35ed477166b4945421d70dd221ec0'
P='__dbk-takedown-rehearsal__/20261113/'
H={'alias.webp':'ff3faebd2f71d24f08b4fdcb5135f36accd8badb7c4dff81e7d7a318457fab50','canary.webp':'ff3faebd2f71d24f08b4fdcb5135f36accd8badb7c4dff81e7d7a318457fab50','control.webp':'5d8814f2a6795e7c976a43d97e98332b9ecf831857db7d0e726604f5b4656997'}
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(['git',*a])
def tree(ref):
    return {n.decode():m.decode() for m,n in (s.split(b'\t',1) for s in git('ls-tree','-rz',ref).split(b'\0') if s)}
old,new=tree(B),tree(S)
assert len(old)==1084 and len(new)==1087
assert {k:v for k,v in new.items() if k in old}==old
assert set(new)-set(old)=={'static/'+P+n for n in H}
assert git('rev-parse',S+'^').decode().strip()==B
assert git('merge-base',S,'HEAD').decode().strip()==S
assert set(tree('HEAD'))-set(new)=={'scripts/04qr-w-pr1049-canary-independent-20261113.py','.github/workflows/04qr-w-pr1049-canary-20261113.yml'}
assert {k:v for k,v in tree('HEAD').items() if k in new}==new
for n,h in H.items():
    p='static/'+P+n
    blob=git('show',S+':'+p)
    assert new[p].startswith('100644 blob ')
    assert len(blob)==44 and sha(blob)==h
    assert blob[:4]==b'RIFF' and blob[8:16]==b'WEBPVP8L'
    assert struct.unpack('<I',blob[4:8])[0]+8==len(blob)
    with Image.open(io.BytesIO(blob)) as im:
        assert im.format=='WEBP' and im.size==(160,160)
        rgb=im.convert('RGB')
        color=(233,181,57) if n=='control.webp' else (61,97,151)
        assert rgb.getextrema()==tuple((v,v) for v in color)
    assert pathlib.Path(p).read_bytes()==blob
print('QRW1049_RAW_TREES_BLOBS_PIXELS_EXACT3_PASS')
root=pathlib.Path('build')
files={p.relative_to(root).as_posix():p.read_bytes() for p in root.rglob('*') if p.is_file()}
expected={P+n for n in H}
def verify(rows):
    names=[n for n,_ in rows]
    assert len(set(names))==len(names)
    assert all(n==pathlib.PurePosixPath(n).as_posix() and not n.startswith('/') and '..' not in pathlib.PurePosixPath(n).parts and '\\' not in n for n in names)
    d=dict(rows)
    assert {n for n in names if n.startswith('__dbk-takedown-rehearsal__/')}==expected
    for n,h in H.items():
        assert len(d[P+n])==44 and sha(d[P+n])==h
    assert not any(n.startswith('ddv/item-images/switch-1.25.3-schema626-lossless160-v1/') for n in names)
    assert not any(n in names for n in ('worker-wasm/ddv_save_core_bg.wasm','worker-wasm/ddv_save_core.js','worker-wasm/manifest.json'))
    return True
rows=sorted(files.items())
assert verify(rows)
archive=io.BytesIO()
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in rows:z.writestr(n,b)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert verify([(i.filename,z.read(i)) for i in z.infolist()])
for bad in [
    rows+[(P+'canary.webp',files[P+'canary.webp'])],
    rows+[(P+'../escaped.webp',b'x')],
    rows+[(P+'hidden.webp',b'x')],
    [(n,b if n!=P+'alias.webp' else files[P+'control.webp']) for n,b in rows],
    [(n,b) for n,b in rows if n!=P+'control.webp'],
    rows+[('ddv/item-images/switch-1.25.3-schema626-lossless160-v1/manifest.json',b'{}')],
    rows+[('worker-wasm/manifest.json',b'{}')]
]:
    try:verify(bad)
    except AssertionError:pass
    else:raise AssertionError('independent negative accepted')
print('QRW1049_ACTUAL_BUILD_ARCHIVE_7NEG_PASS',len(rows),sha(archive.getvalue()))
# Local static origin built artifact, not a managed CDN or Pages deployment.
with tempfile.TemporaryDirectory() as tmp:
    p=pathlib.Path(tmp)
    (p/'web').symlink_to(root.resolve(),target_is_directory=True)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=tmp))
    t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
    origin='http://127.0.0.1:'+str(server.server_port)+'/web/'
    def check(n,method,code,h=None):
        req=urllib.request.Request(origin+n,method=method)
        try:r=urllib.request.urlopen(req,timeout=5)
        except urllib.error.HTTPError as e:r=e
        with r:
            assert r.status==code,(n,method,r.status)
            if code==200:
                assert r.headers.get_content_type()=='image/webp'
                assert r.headers['Content-Length']=='44'
                assert sha(r.read())==h if method=='GET' else r.read()==b''
    try:
        for n,h in H.items():
            for method in ('GET','HEAD'):check(P+n,method,200,h)
        for n in ('hidden.webp','Canary.webp','missing.webp'):
            for method in ('GET','HEAD'):check(P+n,method,404)
        # Remove both aliases from the actual built output, check independent
        # survivor, restore exact original build bytes at end. No public change.
        for n in ('alias.webp','canary.webp'):(root/P/n).unlink()
        for n in ('alias.webp','canary.webp'):
            for method in ('GET','HEAD'):check(P+n,method,404)
        for method in ('GET','HEAD'):check(P+'control.webp',method,200,H['control.webp'])
        print('QRW1049_LOCAL_ACTUAL_BUILT_HTTP_6POS_6NEG_REMOVE4_SURVIVOR2_PASS')
    finally:
        for n in H:(root/P/n).write_bytes(files[P+n])
        server.shutdown();server.server_close();t.join()
assert all((root/n).read_bytes()==b for n,b in rows)
print('QRW1049_LOCAL_RESTORE_EXACT_PASS; MANAGED_PAGES_CDN_NOT_RUN')
