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
-- Password TIDAK disimpan apa adanya, hanya hash PBKDF2 + salt.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  email          TEXT PRIMARY KEY,  -- alamat email, huruf kecil semua
  nama           TEXT NOT NULL,
  hash           TEXT NOT NULL,     -- hash PBKDF2 (base64url)
  salt           TEXT NOT NULL,     -- salt acak (base64url)
  iter           INTEGER NOT NULL,  -- jumlah putaran PBKDF2
  peran          TEXT NOT NULL,     -- 'admin' | 'user'
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

-- Kode undangan. Selama baris ini ada, pintu pendaftaran terbuka.
-- Menghapus barisnya menutup pintu itu seketika, tanpa mengubah kode.
CREATE TABLE IF NOT EXISTS invites (
  kode    TEXT PRIMARY KEY,
  dibuat  TEXT NOT NULL,
  catatan TEXT
);

-- Penghitung percobaan login yang gagal, supaya password tidak bisa ditebak
-- paksa. Dihitung per email per 15 menit; 5 kali salah = tunggu 15 menit.
CREATE TABLE IF NOT EXISTS login_acuan (
  email        TEXT PRIMARY KEY,
  menit        INTEGER NOT NULL DEFAULT 0,  -- menit ke berapa (epoch / 60000)
  gagal        INTEGER NOT NULL DEFAULT 0,
  sampai       TEXT                         -- kalau terisi, email ini sedang diblokir
);

-- Akun pertama TIDAK dibuat di sini. Aturannya: akun pertama yang dibuat lewat
-- halaman /daftar otomatis menjadi admin. Jadi urutannya:
--   1. pasang kode undangan (INSERT ke `invites`)
--   2. buka /daftar, buat akun Anda → otomatis admin
--   3. hapus kode undangan → pintu pendaftaran tertutup
