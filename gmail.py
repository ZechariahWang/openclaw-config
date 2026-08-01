#!/usr/bin/env python3

import imaplib, email, os, sys, re
from email.header import decode_header, make_header

CFG_PATH = os.path.expanduser('~/.config/mail/gmail.env')

def load_cfg():
    cfg = {}
    for line in open(CFG_PATH):
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            cfg[k] = v
    return cfg

def connect(cfg):
    M = imaplib.IMAP4_SSL(cfg['IMAP_HOST'], int(cfg['IMAP_PORT']))
    M.login(cfg['IMAP_USER'], cfg['IMAP_PASS'])
    M.select('INBOX', readonly=True)
    return M

def dh(val):
    if not val:
        return ''
    try:
        return str(make_header(decode_header(val)))
    except Exception:
        return val

def fmt_headers(M, uids):
    out = []
    for uid in uids:
        typ, data = M.uid('fetch', uid, '(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])')
        if typ != 'OK' or not data or not data[0]:
            continue
        msg = email.message_from_bytes(data[0][1])
        out.append((uid.decode(), dh(msg.get('From')), dh(msg.get('Subject')), dh(msg.get('Date'))))
    return out

def latest_uids(M, n, criterion='ALL'):
    typ, d = M.uid('search', None, criterion)
    uids = d[0].split() if d and d[0] else []
    return list(reversed(uids))[:n]

def cmd_list(M, n):
    for uid, frm, subj, date in fmt_headers(M, latest_uids(M, n, 'ALL')):
        print(f"[{uid}] {date}\n  from: {frm}\n  subj: {subj}\n")

def cmd_unread(M, n):
    for uid, frm, subj, date in fmt_headers(M, latest_uids(M, n, 'UNSEEN')):
        print(f"[{uid}] {date}\n  from: {frm}\n  subj: {subj}\n")

def cmd_search(M, q, n=20):
    for uid, frm, subj, date in fmt_headers(M, latest_uids(M, n, q)):
        print(f"[{uid}] {date}\n  from: {frm}\n  subj: {subj}\n")

def cmd_read(M, uid):
    typ, data = M.uid('fetch', uid.encode(), '(BODY.PEEK[])')
    if typ != 'OK' or not data or not data[0]:
        print('not found'); return
    msg = email.message_from_bytes(data[0][1])
    print('From:', dh(msg.get('From')))
    print('Subject:', dh(msg.get('Subject')))
    print('Date:', dh(msg.get('Date')))
    print('-' * 40)
    body = ''
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == 'text/plain' and 'attachment' not in str(part.get('Content-Disposition')):
                body = part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', 'replace')
                break
    else:
        body = msg.get_payload(decode=True).decode(msg.get_content_charset() or 'utf-8', 'replace')
    print(re.sub(r'\n{3,}', '\n\n', body).strip()[:4000])

def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); return
    cfg = load_cfg()
    M = connect(cfg)
    try:
        c = args[0]
        if c == 'list':
            cmd_list(M, int(args[1]) if len(args) > 1 else 10)
        elif c == 'unread':
            cmd_unread(M, int(args[1]) if len(args) > 1 else 10)
        elif c == 'read':
            cmd_read(M, args[1])
        elif c == 'search':
            cmd_search(M, args[1])
        else:
            print(__doc__)
    finally:
        M.logout()

if __name__ == '__main__':
    main()
