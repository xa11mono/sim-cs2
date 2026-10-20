#!/usr/bin/env python3
"""Чтение одиночного VPK (v1/v2, данные внутри файла — как de_<карта>.vpk из папки maps игры): files(path) → {имя: (смещение, длина)}."""
import struct

def open_vpk(path):
    d = open(path, 'rb').read()
    sig, ver, tree = struct.unpack_from('<III', d, 0); hdr = 28 if ver == 2 else 12
    p = hdr; files = {}
    def cstr():
        nonlocal p
        e = d.index(b'\0', p); s = d[p:e].decode('utf-8', 'replace'); p = e + 1; return s
    while True:
        ext = cstr()
        if not ext: break
        while True:
            dr = cstr()
            if not dr: break
            while True:
                name = cstr()
                if not name: break
                crc, pre, arch, off, ln, term = struct.unpack_from('<IHHIIH', d, p); p += 18
                pre_bytes = d[p:p + pre]; p += pre
                assert arch == 0x7FFF, 'данные во внешнем архиве — не поддержано'
                files[(dr + '/' if dr.strip() else '') + name + '.' + ext] = (hdr + tree + off, ln, pre_bytes)
    def read(name):
        o, n, pre = files[name]; return pre + d[o:o + n]
    return files, read
