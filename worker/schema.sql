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
