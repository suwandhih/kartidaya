-- ============================================================
-- Skema database bersama Kartidaya (Cloudflare D1)
--
-- Dibuat dengan:  npx wrangler d1 execute kartidaya --remote --file=schema.sql
--
-- Kenapa dua tabel saja?
--   `records` menyimpan semua data yang berbentuk DAFTAR (donor, surat,
--   template, kategori, program, keuangan). Satu baris = satu data.
--   `meta`    menyimpan data yang bentuknya SATU nilai saja (5 isian serba
--   guna, info majalah).
--
-- Kolom `data` berisi JSON, bukan kolom terpisah per field. Alasannya: field
-- donor bisa bertambah/berubah tanpa perlu mengubah struktur database. Aplikasi
-- sudah bekerja dengan objek JavaScript, jadi JSON paling cocok.
-- ============================================================

CREATE TABLE IF NOT EXISTS records (
  collection TEXT NOT NULL,   -- 'donors' | 'messages' | 'templates' | ...
  id         TEXT NOT NULL,   -- id data (mis. L00024R)
  data       TEXT NOT NULL,   -- isi data dalam bentuk JSON
  updated_at TEXT NOT NULL,   -- waktu perubahan terakhir (ISO)
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_records_collection ON records (collection);

CREATE TABLE IF NOT EXISTS meta (
  key        TEXT PRIMARY KEY,  -- 'isian' | 'majalah'
  data       TEXT NOT NULL,     -- isi dalam bentuk JSON
  updated_at TEXT NOT NULL
);

-- ============================================================
-- Akun pengguna (login aplikasi Kartidaya)
--
-- Kenapa perlu tabel sendiri, bukan menumpang `records`?
-- `records` isinya data yang dibaca aplikasi lewat GET /data — dan GET /data
-- memang hanya butuh kunci aplikasi. Kalau password ikut di sana, siapa pun
-- yang punya kunci bisa membaca seluruh hash password. Tabel terpisah tidak
-- pernah ikut terkirim oleh /data.
--
-- Password disimpan dalam bentuk hash + salt (bukan tulisan biasa), tetapi
-- sengaja TIDAK dibuat berlapis-lapis: ini masih fase tes.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  email          TEXT PRIMARY KEY,  -- alamat email, huruf kecil semua
  nama           TEXT NOT NULL,
  hash           TEXT NOT NULL,     -- hash password (base64url)
  salt           TEXT NOT NULL,     -- salt acak (base64url)
  iter           INTEGER NOT NULL,  -- jumlah putaran
  peran          TEXT NOT NULL,     -- 'admin' | 'donor' | 'keuangan'
  aktif          INTEGER NOT NULL DEFAULT 1,
  dibuat         TEXT NOT NULL,
  masuk_terakhir TEXT
);

-- Token sesi. Disimpan di server supaya bisa dicabut sebelum kedaluwarsa
-- (mis. orang keluar atau akun dimatikan).
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,   -- token acak 32 byte (base64url)
  email       TEXT NOT NULL,
  peran       TEXT NOT NULL,
  dibuat      TEXT NOT NULL,
  kedaluwarsa TEXT NOT NULL       -- ISO; berlaku 12 jam
);

CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions (email);

-- ============================================================
-- Catatan aktivitas ("CCTV")
--
-- Satu baris = satu kejadian: masuk, keluar, tambah, ubah, hapus.
-- Gunanya kalau ada data yang berubah dan perlu ditelusuri siapa pelakunya.
-- Hanya dicatat, tidak membatasi apa pun.
-- ============================================================

CREATE TABLE IF NOT EXISTS aktivitas (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  waktu    TEXT NOT NULL,          -- ISO
  email    TEXT NOT NULL,          -- siapa yang melakukan
  nama     TEXT,
  aksi     TEXT NOT NULL,          -- 'masuk' | 'keluar' | 'tambah' | 'ubah' | 'hapus'
  bagian   TEXT,                   -- 'donor' | 'surat' | 'keuangan' | 'akun' | ...
  sasaran  TEXT,                   -- id/nama data yang disentuh
  ket      TEXT                    -- keterangan singkat
);

CREATE INDEX IF NOT EXISTS idx_aktivitas_waktu ON aktivitas (waktu);
CREATE INDEX IF NOT EXISTS idx_aktivitas_email ON aktivitas (email);

-- Akun pertama dibuat dari halaman /daftar dan otomatis menjadi admin.
-- Setelah itu hanya admin yang bisa membuat akun, dari dalam halaman /daftar.
