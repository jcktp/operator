/*
  Warnings:

  - You are about to drop the `MatrixMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MatrixRoom` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MatrixMessage";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MatrixRoom";
PRAGMA foreign_keys=on;
