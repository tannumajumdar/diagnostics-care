-- Ayushman Bharat Health Account on the patient record: number and address, both optional.
ALTER TABLE "Patient" ADD COLUMN "abhaNumber" TEXT NOT NULL DEFAULT '',
                      ADD COLUMN "abhaAddress" TEXT NOT NULL DEFAULT '';
