#!/usr/bin/env python3
"""Server statis kecil untuk aplikasi Kartidaya.

Wajib dipakai agar OAuth Google bisa berjalan, karena Google menolak
origin `file://`. Jalankan lewat serve.bat, lalu buka http://localhost:8080

Server juga mendengarkan di alamat LAN supaya aplikasi bisa dibuka dari
HP Android yang tersambung ke Wi-Fi yang sama.
"""
import http.server
import os
import socket
import socketserver
import sys
import webbrowser

PORT = int(os.environ.get("PORT", "8080"))
ROOT = os.path.dirname(os.path.abspath(__file__))


def lan_ip():
    """Perkiraan alamat IP PC di jaringan lokal."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("  %s\n" % (fmt % args))
        sys.stdout.flush()


class Server(socketserver.ThreadingTCPServer):
    """Threaded: browser membuka beberapa koneksi sekaligus."""
    allow_reuse_address = True
    daemon_threads = True


def main():
    try:
        httpd = Server(("0.0.0.0", PORT), Handler)
    except OSError as exc:
        print("Gagal membuka port %d: %s" % (PORT, exc))
        print("Coba port lain:  set PORT=8081 && python serve.py")
        return 1

    url = "http://localhost:%d/index.html" % PORT
    print("=" * 64)
    print("  Kartidaya - server lokal")
    print("  PC     : %s" % url)
    ip = lan_ip()
    if ip:
        print("  Android: http://%s:%d/index.html" % (ip, PORT))
        print("           (HP harus di Wi-Fi yang sama)")
    print("  Hentikan: Ctrl+C")
    print("=" * 64)
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
